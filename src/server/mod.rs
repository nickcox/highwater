mod assets;

use crate::{
    analysis::{analyze, AnalysisConfig, AnalysisError, TokenizationPolicy},
    domain::SourceError,
    pi::PiSourceAdapter,
};
use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use chrono::{DateTime, Utc};
use clap::{Parser, ValueEnum};
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::HashMap,
    fs::{self, File},
    io::{BufRead, BufReader},
    net::SocketAddr,
    path::{Path as FsPath, PathBuf},
    sync::{Arc, Mutex},
    time::{Instant, UNIX_EPOCH},
};
use thiserror::Error;
use tokio::sync::watch;

#[derive(Debug, Clone, Copy, ValueEnum)]
pub(crate) enum TokenizationArg {
    Auto,
    Strict,
    Heuristic,
    Off,
}

impl From<TokenizationArg> for TokenizationPolicy {
    fn from(value: TokenizationArg) -> Self {
        match value {
            TokenizationArg::Auto => Self::Auto,
            TokenizationArg::Strict => Self::Strict,
            TokenizationArg::Heuristic => Self::Heuristic,
            TokenizationArg::Off => Self::Off,
        }
    }
}

#[derive(Parser, Debug)]
pub(crate) struct Args {
    #[arg(long)]
    pub session_root: Option<PathBuf>,
    #[arg(long, default_value_t = 43123)]
    pub port: u16,
    #[arg(long)]
    pub no_open: bool,
    #[arg(long, value_enum, default_value_t = TokenizationArg::Auto)]
    pub tokenization: TokenizationArg,
    #[arg(long)]
    pub perf_diagnostics: bool,
}

type AnalysisExecutor = dyn Fn(PathBuf, AnalysisConfig, AnalysisCacheKey) -> Result<Arc<CachedResponse>, FlightError>
    + Send
    + Sync;

#[derive(Clone)]
pub(crate) struct AppState {
    sessions: Arc<Vec<SessionFile>>,
    config: AnalysisConfig,
    analysis_cache: Arc<Mutex<AnalysisCache>>,
    analysis_flights: Arc<Mutex<HashMap<AnalysisCacheKey, Arc<AnalysisFlight>>>>,
    analysis_executor: Arc<AnalysisExecutor>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct AnalysisCacheKey {
    path: PathBuf,
    byte_size: u64,
    modified_nanos: u128,
    tokenization: TokenizationPolicy,
    schema_version: u32,
    output_version: u32,
}

#[derive(Debug)]
struct CachedResponse {
    body: bytes::Bytes,
    etag: String,
    approximate_bytes: usize,
}

#[derive(Debug)]
struct CachedEntry {
    last_used: u64,
    response: Arc<CachedResponse>,
}

#[derive(Debug)]
struct AnalysisCache {
    entries: HashMap<AnalysisCacheKey, CachedEntry>,
    clock: u64,
    capacity: usize,
    byte_capacity: usize,
    bytes: usize,
    hits: u64,
    evictions: u64,
}

#[derive(Debug)]
struct AnalysisFlight {
    result: watch::Sender<Option<Result<Arc<CachedResponse>, FlightError>>>,
}

#[derive(Debug, Clone)]
enum FlightError {
    Source(String),
    Analysis(String),
    Message(String),
}

impl FlightError {
    fn into_app_error(self) -> AppError {
        match self {
            Self::Source(message) => AppError::SourceMessage(message),
            Self::Analysis(message) => AppError::AnalysisMessage(message),
            Self::Message(message) => AppError::Message(message),
        }
    }
}

impl Default for AnalysisCache {
    fn default() -> Self {
        Self::with_limits(4, 16 * 1024 * 1024)
    }
}

impl AnalysisCache {
    #[cfg(test)]
    fn new(capacity: usize) -> Self {
        Self::with_limits(capacity, 16 * 1024 * 1024)
    }

    fn with_limits(capacity: usize, byte_capacity: usize) -> Self {
        Self {
            entries: HashMap::new(),
            clock: 0,
            capacity: capacity.max(1),
            byte_capacity: byte_capacity.max(1),
            bytes: 0,
            hits: 0,
            evictions: 0,
        }
    }

    fn get(&mut self, key: &AnalysisCacheKey) -> Option<Arc<CachedResponse>> {
        self.clock = self.clock.saturating_add(1);
        let last_used = self.clock;
        let cached = self.entries.get_mut(key)?;
        self.hits = self.hits.saturating_add(1);
        cached.last_used = last_used;
        Some(Arc::clone(&cached.response))
    }

    fn insert(&mut self, key: AnalysisCacheKey, response: Arc<CachedResponse>) {
        if response.approximate_bytes > self.byte_capacity {
            return;
        }
        if let Some(previous) = self.entries.remove(&key) {
            self.bytes = self
                .bytes
                .saturating_sub(previous.response.approximate_bytes);
        }
        self.clock = self.clock.saturating_add(1);
        let last_used = self.clock;
        self.bytes = self.bytes.saturating_add(response.approximate_bytes);
        self.entries.insert(
            key,
            CachedEntry {
                last_used,
                response,
            },
        );
        while self.entries.len() > self.capacity || self.bytes > self.byte_capacity {
            let Some(oldest_key) = self
                .entries
                .iter()
                .min_by_key(|(_, cached)| cached.last_used)
                .map(|(key, _)| key.clone())
            else {
                break;
            };
            if let Some(entry) = self.entries.remove(&oldest_key) {
                self.bytes = self.bytes.saturating_sub(entry.response.approximate_bytes);
                self.evictions = self.evictions.saturating_add(1);
            }
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionFile {
    id: String,
    path: String,
    file_name: String,
    display_name: String,
    working_directory: Option<String>,
    started_at: Option<DateTime<Utc>>,
    byte_size: u64,
    modified_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Error)]
pub(crate) enum AppError {
    #[error("cannot read session: {0}")]
    Io(#[from] std::io::Error),
    #[error("source session is invalid: {0}")]
    Source(#[from] SourceError),
    #[error("source session is invalid: {0}")]
    SourceMessage(String),
    #[error("analysis failed: {0}")]
    Analysis(#[from] AnalysisError),
    #[error("analysis failed: {0}")]
    AnalysisMessage(String),
    #[error("cannot fingerprint session: {0}")]
    Fingerprint(String),
    #[error("{0}")]
    Message(String),
    #[error("unknown session")]
    NotFound,
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, code) = match &self {
            Self::NotFound => (StatusCode::NOT_FOUND, "SESSION_NOT_FOUND"),
            Self::Source(_) | Self::SourceMessage(_) => {
                (StatusCode::UNPROCESSABLE_ENTITY, "SESSION_PARSE_FAILED")
            }
            _ => (StatusCode::BAD_REQUEST, "SESSION_ANALYSIS_FAILED"),
        };
        (
            status,
            Json(serde_json::json!({ "error": { "code": code, "message": self.to_string() } })),
        )
            .into_response()
    }
}

pub(crate) async fn run(args: Args) -> Result<(), Box<dyn std::error::Error>> {
    let root = args.session_root.unwrap_or_else(|| {
        PathBuf::from(std::env::var("HOME").unwrap_or_default()).join(".pi/agent/sessions")
    });
    let sessions = discover(&root)?;
    println!("Discovered {} sessions", sessions.len());
    let state = AppState {
        sessions: Arc::new(sessions),
        config: AnalysisConfig {
            tokenization: args.tokenization.into(),
            perf_diagnostics: args.perf_diagnostics,
        },
        analysis_cache: Arc::new(Mutex::new(AnalysisCache::default())),
        analysis_flights: Arc::new(Mutex::new(HashMap::new())),
        analysis_executor: Arc::new(execute_analysis),
    };
    let app = router(state);
    let address = SocketAddr::from(([127, 0, 0, 1], args.port));
    println!("Listening on http://{address}");
    let listener = tokio::net::TcpListener::bind(address).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn session_listing_metadata(
    path: &FsPath,
    file_name: &str,
) -> (String, Option<String>, Option<DateTime<Utc>>) {
    let header = File::open(path)
        .ok()
        .and_then(|file| BufReader::new(file).lines().next())
        .and_then(Result::ok)
        .and_then(|line| serde_json::from_str::<Value>(&line).ok());
    let working_directory = header
        .as_ref()
        .and_then(|value| value.get("cwd"))
        .and_then(Value::as_str)
        .map(str::to_owned);
    let started_at = header
        .as_ref()
        .and_then(|value| value.get("timestamp"))
        .and_then(Value::as_str)
        .and_then(|timestamp| timestamp.parse::<DateTime<Utc>>().ok());
    let stem = file_name.strip_suffix(".jsonl").unwrap_or(file_name);
    let suffix = stem
        .rsplit_once('_')
        .map(|(_, suffix)| suffix)
        .filter(|suffix| !suffix.is_empty())
        .map(|suffix| suffix.chars().take(8).collect::<String>());
    let project = working_directory
        .as_deref()
        .and_then(|directory| FsPath::new(directory).file_name())
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty());
    let timestamp_label = started_at.map(|timestamp| timestamp.format("%b %d %H:%M").to_string());
    let display_name = match (project, timestamp_label, suffix) {
        (Some(project), Some(timestamp), Some(suffix)) => {
            format!("{project} · {timestamp} · {suffix}")
        }
        (Some(project), Some(timestamp), None) => format!("{project} · {timestamp}"),
        (Some(project), None, Some(suffix)) => format!("{project} · {suffix}"),
        _ => stem.chars().take(48).collect(),
    };
    (display_name, working_directory, started_at)
}

fn discover(root: &FsPath) -> Result<Vec<SessionFile>, AppError> {
    if !root.exists() {
        return Err(AppError::Message(format!(
            "session root does not exist: {}",
            root.display()
        )));
    }
    let mut output = Vec::new();
    fn walk(path: &FsPath, output: &mut Vec<SessionFile>) -> std::io::Result<()> {
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                walk(&path, output)?;
            } else if path.extension().and_then(|extension| extension.to_str()) == Some("jsonl") {
                let metadata = entry.metadata()?;
                let (display_name, working_directory, started_at) =
                    session_listing_metadata(&path, &entry.file_name().to_string_lossy());
                let path_string = path.to_string_lossy().into_owned();
                output.push(SessionFile {
                    id: path_string.clone(),
                    path: path_string,
                    file_name: entry.file_name().to_string_lossy().into_owned(),
                    display_name,
                    working_directory,
                    started_at,
                    byte_size: metadata.len(),
                    modified_at: metadata.modified().ok().map(DateTime::<Utc>::from),
                });
            }
        }
        Ok(())
    }
    walk(root, &mut output)?;
    output.sort_by_key(|session| std::cmp::Reverse(session.modified_at));
    Ok(output)
}

fn analysis_cache_key(path: &FsPath, config: AnalysisConfig) -> Result<AnalysisCacheKey, AppError> {
    let metadata = fs::metadata(path)?;
    let modified_nanos = metadata
        .modified()
        .map_err(|error| AppError::Fingerprint(error.to_string()))?
        .duration_since(UNIX_EPOCH)
        .map_err(|error| AppError::Fingerprint(error.to_string()))?
        .as_nanos();
    let canonical_path = fs::canonicalize(path)?;
    Ok(AnalysisCacheKey {
        path: canonical_path,
        byte_size: metadata.len(),
        modified_nanos,
        tokenization: config.tokenization,
        schema_version: crate::analysis::ANALYSIS_SCHEMA_VERSION,
        output_version: crate::analysis::ANALYSIS_OUTPUT_VERSION,
    })
}

fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/sessions", get(sessions))
        .route("/api/sessions/{id}/analysis", get(session_analysis))
        .fallback(assets::static_file)
        .with_state(state)
}

async fn sessions(State(state): State<AppState>) -> Json<Value> {
    Json(serde_json::json!({ "sessions": &*state.sessions }))
}

async fn session_analysis(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let session = state
        .sessions
        .iter()
        .find(|session| session.id == id || session.file_name == id)
        .ok_or(AppError::NotFound)?;
    let path = FsPath::new(&session.path).to_path_buf();
    let key = analysis_cache_key(&path, state.config)?;

    // Keep the cache lookup and flight registration in one lock ordering.
    // The publisher takes these locks in the same order, so a request cannot
    // observe both a missing cache entry and a removed flight.
    let (flight, should_start) = {
        let mut cache = state
            .analysis_cache
            .lock()
            .map_err(|_| AppError::Message("analysis cache is unavailable".into()))?;
        if let Some(response) = cache.get(&key) {
            return response_for(&response, &headers);
        }
        let mut flights = state
            .analysis_flights
            .lock()
            .map_err(|_| AppError::Message("analysis flight state is unavailable".into()))?;
        if let Some(flight) = flights.get(&key) {
            (Arc::clone(flight), false)
        } else {
            let (result, _receiver) = watch::channel(None);
            let flight = Arc::new(AnalysisFlight { result });
            flights.insert(key.clone(), Arc::clone(&flight));
            (flight, true)
        }
    };

    if should_start {
        start_analysis(
            Arc::clone(&state.analysis_cache),
            Arc::clone(&state.analysis_flights),
            key.clone(),
            path.clone(),
            state.config,
            Arc::clone(&flight),
            Arc::clone(&state.analysis_executor),
        );
    }

    let mut receiver = flight.result.subscribe();
    let current = receiver.borrow().clone();
    let result = match current {
        Some(result) => result,
        None => {
            receiver
                .changed()
                .await
                .map_err(|_| AppError::Message("analysis flight ended unexpectedly".into()))?;
            receiver
                .borrow()
                .clone()
                .ok_or_else(|| AppError::Message("analysis flight ended without a result".into()))?
        }
    };
    match result {
        Ok(response) => response_for(&response, &headers),
        Err(error) => Err(error.into_app_error()),
    }
}

fn start_analysis(
    cache: Arc<Mutex<AnalysisCache>>,
    flights: Arc<Mutex<HashMap<AnalysisCacheKey, Arc<AnalysisFlight>>>>,
    key: AnalysisCacheKey,
    path: PathBuf,
    config: AnalysisConfig,
    flight: Arc<AnalysisFlight>,
    executor: Arc<AnalysisExecutor>,
) {
    tokio::spawn(async move {
        let response_key = key.clone();
        let result =
            match tokio::task::spawn_blocking(move || executor(path, config, response_key)).await {
                Ok(result) => result,
                Err(error) => Err(FlightError::Message(format!(
                    "analysis task failed: {error}"
                ))),
            };

        if let Ok(response) = &result {
            if let Ok(mut cache_state) = cache.lock() {
                cache_state.insert(key.clone(), Arc::clone(response));
            }
        }
        flight.result.send_replace(Some(result));
        if let Ok(mut active) = flights.lock() {
            active.remove(&key);
        }
    });
}

fn execute_analysis(
    path: PathBuf,
    config: AnalysisConfig,
    response_key: AnalysisCacheKey,
) -> Result<Arc<CachedResponse>, FlightError> {
    let source_bytes = fs::metadata(&path)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    let parse_started = Instant::now();
    let (normalized, parse_stats) = PiSourceAdapter
        .parse_path_with_stats(&path)
        .map_err(|error| FlightError::Source(error.to_string()))?;
    let parse_ms = parse_started.elapsed().as_secs_f64() * 1000.0;
    let analysis_started = Instant::now();
    let analysis =
        analyze(normalized, config).map_err(|error| FlightError::Analysis(error.to_string()))?;
    let analysis_ms = analysis_started.elapsed().as_secs_f64() * 1000.0;
    let serialization_started = Instant::now();
    let body =
        serde_json::to_vec(&analysis).map_err(|error| FlightError::Message(error.to_string()))?;
    if config.perf_diagnostics {
        eprintln!(
            "analysis_perf parse_ms={parse_ms:.3} analyze_ms={analysis_ms:.3} serialize_ms={:.3} source_bytes={source_bytes} response_bytes={} entries={} selected_entries={} calls={} items={} presences={}",
            serialization_started.elapsed().as_secs_f64() * 1000.0,
            body.len(),
            parse_stats.entries,
            parse_stats.selected_entries,
            analysis.model_calls.len(),
            analysis.context_items.len(),
            analysis
                .context_items
                .iter()
                .map(|item| item.presence_call_count)
                .sum::<usize>(),
        );
    }
    Ok(Arc::new(CachedResponse {
        approximate_bytes: body.len(),
        body: bytes::Bytes::from(body),
        etag: etag_for_key(&response_key),
    }))
}

fn etag_for_key(key: &AnalysisCacheKey) -> String {
    let mut hasher = blake3::Hasher::new();
    hasher.update(key.path.to_string_lossy().as_bytes());
    hasher.update(&key.byte_size.to_le_bytes());
    hasher.update(&key.modified_nanos.to_le_bytes());
    hasher.update(key.tokenization.as_str().as_bytes());
    hasher.update(&key.schema_version.to_le_bytes());
    hasher.update(&key.output_version.to_le_bytes());
    format!("\"{}\"", hasher.finalize().to_hex())
}

fn response_for(response: &CachedResponse, headers: &HeaderMap) -> Result<Response, AppError> {
    let matches = headers
        .get(header::IF_NONE_MATCH)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| {
            value
                .split(',')
                .any(|candidate| candidate.trim() == response.etag)
        });
    let mut builder = Response::builder().header(header::ETAG, response.etag.as_str());
    if matches {
        return builder
            .status(StatusCode::NOT_MODIFIED)
            .body(axum::body::Body::empty())
            .map_err(|error| AppError::Message(format!("cannot build response: {error}")));
    }
    builder = builder
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::CONTENT_LENGTH, response.body.len());
    builder
        .status(StatusCode::OK)
        .body(axum::body::Body::from(response.body.clone()))
        .map_err(|error| AppError::Message(format!("cannot build response: {error}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::Analysis;
    use std::{
        fs as std_fs,
        sync::{
            atomic::{AtomicUsize, Ordering},
            Condvar,
        },
        thread,
        time::{Duration, SystemTime, UNIX_EPOCH},
    };
    use tower::ServiceExt;

    fn fixture_session(path: impl Into<String>, file_name: impl Into<String>) -> SessionFile {
        SessionFile {
            id: "fixture".into(),
            path: path.into(),
            file_name: file_name.into(),
            display_name: "fixture".into(),
            working_directory: None,
            started_at: None,
            byte_size: 1,
            modified_at: None,
        }
    }

    fn request(file_name: &str) -> axum::http::Request<axum::body::Body> {
        axum::http::Request::builder()
            .uri(format!("/api/sessions/{file_name}/analysis"))
            .body(axum::body::Body::empty())
            .expect("request")
    }

    fn test_state(
        session: SessionFile,
        config: AnalysisConfig,
        analysis_cache: Arc<Mutex<AnalysisCache>>,
    ) -> AppState {
        test_state_with_executor(
            vec![session],
            config,
            analysis_cache,
            Arc::new(execute_analysis),
        )
    }

    fn test_state_with_executor(
        sessions: Vec<SessionFile>,
        config: AnalysisConfig,
        analysis_cache: Arc<Mutex<AnalysisCache>>,
        analysis_executor: Arc<AnalysisExecutor>,
    ) -> AppState {
        AppState {
            sessions: Arc::new(sessions),
            config,
            analysis_cache,
            analysis_flights: Arc::new(Mutex::new(HashMap::new())),
            analysis_executor,
        }
    }

    #[derive(Default)]
    struct BlockingGate {
        released: Mutex<bool>,
        changed: Condvar,
    }

    impl BlockingGate {
        fn wait(&self) {
            let mut released = self.released.lock().expect("gate");
            while !*released {
                released = self.changed.wait(released).expect("gate");
            }
        }

        fn release(&self) {
            *self.released.lock().expect("gate") = true;
            self.changed.notify_all();
        }
    }

    struct GateGuard(Arc<BlockingGate>);

    impl Drop for GateGuard {
        fn drop(&mut self) {
            self.0.release();
        }
    }

    fn blocking_gate() -> (Arc<BlockingGate>, GateGuard) {
        let gate = Arc::new(BlockingGate::default());
        (Arc::clone(&gate), GateGuard(gate))
    }

    async fn wait_for_flight_receivers(state: &AppState, expected: usize) {
        tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                let receivers = state
                    .analysis_flights
                    .lock()
                    .expect("flights")
                    .values()
                    .next()
                    .map(|flight| flight.result.receiver_count())
                    .unwrap_or(0);
                if receivers >= expected {
                    return;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap_or_else(|_| panic!("flight did not reach {expected} receivers"));
    }

    async fn response_body(response: axum::response::Response) -> Vec<u8> {
        axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("response body")
            .to_vec()
    }

    fn cached_response(analysis: &Analysis) -> Arc<CachedResponse> {
        let body = serde_json::to_vec(analysis).expect("analysis JSON");
        Arc::new(CachedResponse {
            approximate_bytes: body.len(),
            body: bytes::Bytes::from(body),
            etag: "\"test\"".into(),
        })
    }

    fn sized_response(size: usize) -> Arc<CachedResponse> {
        Arc::new(CachedResponse {
            approximate_bytes: size,
            body: bytes::Bytes::from(vec![b'x'; size]),
            etag: "\"test\"".into(),
        })
    }

    #[tokio::test]
    async fn api_route_reuses_cache_and_returns_deterministic_output() {
        let cache = Arc::new(Mutex::new(AnalysisCache::default()));
        let app = router(test_state(
            fixture_session("fixtures/pi/simple.jsonl", "simple.jsonl"),
            AnalysisConfig {
                tokenization: TokenizationPolicy::Heuristic,
                perf_diagnostics: false,
            },
            Arc::clone(&cache),
        ));
        let first = app
            .clone()
            .oneshot(request("simple.jsonl"))
            .await
            .expect("first response");
        assert_eq!(first.status(), StatusCode::OK);
        let first_body = response_body(first).await;
        let second = app
            .oneshot(request("simple.jsonl"))
            .await
            .expect("second response");
        assert_eq!(second.status(), StatusCode::OK);
        assert_eq!(first_body, response_body(second).await);
        let uncached = router(test_state(
            fixture_session("fixtures/pi/simple.jsonl", "simple.jsonl"),
            AnalysisConfig {
                tokenization: TokenizationPolicy::Heuristic,
                perf_diagnostics: false,
            },
            Arc::new(Mutex::new(AnalysisCache::default())),
        ))
        .oneshot(request("simple.jsonl"))
        .await
        .expect("uncached response");
        assert_eq!(first_body, response_body(uncached).await);
        let cache = cache.lock().expect("cache");
        assert_eq!(cache.entries.len(), 1);
        assert_eq!(cache.hits, 1);
    }

    #[tokio::test]
    async fn matching_etag_returns_not_modified_without_a_body() {
        let app = router(test_state(
            fixture_session("fixtures/pi/simple.jsonl", "simple.jsonl"),
            AnalysisConfig {
                tokenization: TokenizationPolicy::Heuristic,
                perf_diagnostics: false,
            },
            Arc::new(Mutex::new(AnalysisCache::default())),
        ));
        let first = app
            .clone()
            .oneshot(request("simple.jsonl"))
            .await
            .expect("first response");
        let etag = first
            .headers()
            .get(axum::http::header::ETAG)
            .cloned()
            .expect("etag");
        let mut conditional = request("simple.jsonl");
        conditional
            .headers_mut()
            .insert(axum::http::header::IF_NONE_MATCH, etag);
        let response = app
            .oneshot(conditional)
            .await
            .expect("conditional response");
        assert_eq!(response.status(), StatusCode::NOT_MODIFIED);
        assert!(response_body(response).await.is_empty());
    }

    #[test]
    fn completed_flight_retains_result_without_subscribers() {
        let (result, receiver) = watch::channel(None);
        drop(receiver);
        let flight = AnalysisFlight { result };
        let response = sized_response(1);

        flight.result.send_replace(Some(Ok(Arc::clone(&response))));

        let receiver = flight.result.subscribe();
        let published = receiver.borrow().clone().expect("published result");
        assert!(Arc::ptr_eq(
            &published.expect("successful result"),
            &response
        ));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn concurrent_same_key_requests_execute_once() {
        let invocations = Arc::new(AtomicUsize::new(0));
        let (gate, release) = blocking_gate();
        let executor: Arc<AnalysisExecutor> = {
            let invocations = Arc::clone(&invocations);
            let gate = Arc::clone(&gate);
            Arc::new(move |_, _, _| {
                invocations.fetch_add(1, Ordering::SeqCst);
                gate.wait();
                Ok(sized_response(6))
            })
        };
        let cache = Arc::new(Mutex::new(AnalysisCache::default()));
        let state = test_state_with_executor(
            vec![fixture_session("fixtures/pi/simple.jsonl", "simple.jsonl")],
            AnalysisConfig {
                tokenization: TokenizationPolicy::Heuristic,
                perf_diagnostics: false,
            },
            Arc::clone(&cache),
            executor,
        );
        let app = router(state.clone());
        let first = tokio::spawn(app.clone().oneshot(request("simple.jsonl")));
        while invocations.load(Ordering::SeqCst) == 0 {
            tokio::task::yield_now().await;
        }
        let second = tokio::spawn(app.oneshot(request("simple.jsonl")));
        wait_for_flight_receivers(&state, 2).await;
        assert_eq!(invocations.load(Ordering::SeqCst), 1);
        release.0.release();

        let first = first.await.expect("first task").expect("first response");
        let second = second.await.expect("second task").expect("second response");
        assert_eq!(first.status(), StatusCode::OK);
        assert_eq!(second.status(), StatusCode::OK);
        assert_eq!(response_body(first).await, response_body(second).await);
        assert_eq!(invocations.load(Ordering::SeqCst), 1);
        assert_eq!(cache.lock().expect("cache").entries.len(), 1);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn failed_flight_wakes_waiters_and_can_be_retried() {
        let invocations = Arc::new(AtomicUsize::new(0));
        let (gate, release) = blocking_gate();
        let executor: Arc<AnalysisExecutor> = {
            let invocations = Arc::clone(&invocations);
            let gate = Arc::clone(&gate);
            Arc::new(move |_, _, _| {
                let invocation = invocations.fetch_add(1, Ordering::SeqCst);
                if invocation == 0 {
                    gate.wait();
                    Err(FlightError::Source("controlled parse failure".into()))
                } else {
                    Ok(sized_response(7))
                }
            })
        };
        let cache = Arc::new(Mutex::new(AnalysisCache::default()));
        let state = test_state_with_executor(
            vec![fixture_session("fixtures/pi/simple.jsonl", "simple.jsonl")],
            AnalysisConfig {
                tokenization: TokenizationPolicy::Heuristic,
                perf_diagnostics: false,
            },
            Arc::clone(&cache),
            executor,
        );
        let app = router(state.clone());
        let first = tokio::spawn(app.clone().oneshot(request("simple.jsonl")));
        while invocations.load(Ordering::SeqCst) == 0 {
            tokio::task::yield_now().await;
        }
        let second = tokio::spawn(app.clone().oneshot(request("simple.jsonl")));
        wait_for_flight_receivers(&state, 2).await;
        release.0.release();

        for response in [first, second] {
            let response = response.await.expect("request task").expect("response");
            assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
            assert!(String::from_utf8(response_body(response).await)
                .expect("UTF-8 error")
                .contains("SESSION_PARSE_FAILED"));
        }
        assert!(cache.lock().expect("cache").entries.is_empty());
        assert!(state.analysis_flights.lock().expect("flights").is_empty());

        let retry = app
            .oneshot(request("simple.jsonl"))
            .await
            .expect("retry response");
        assert_eq!(retry.status(), StatusCode::OK);
        assert_eq!(invocations.load(Ordering::SeqCst), 2);
        assert_eq!(cache.lock().expect("cache").entries.len(), 1);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn cancelling_initiator_does_not_cancel_shared_analysis() {
        let invocations = Arc::new(AtomicUsize::new(0));
        let (gate, release) = blocking_gate();
        let executor: Arc<AnalysisExecutor> = {
            let invocations = Arc::clone(&invocations);
            let gate = Arc::clone(&gate);
            Arc::new(move |_, _, _| {
                invocations.fetch_add(1, Ordering::SeqCst);
                gate.wait();
                Ok(sized_response(8))
            })
        };
        let state = test_state_with_executor(
            vec![fixture_session("fixtures/pi/simple.jsonl", "simple.jsonl")],
            AnalysisConfig {
                tokenization: TokenizationPolicy::Heuristic,
                perf_diagnostics: false,
            },
            Arc::new(Mutex::new(AnalysisCache::default())),
            executor,
        );
        let app = router(state.clone());
        let initiator = tokio::spawn(app.clone().oneshot(request("simple.jsonl")));
        while invocations.load(Ordering::SeqCst) == 0 {
            tokio::task::yield_now().await;
        }
        let waiter = tokio::spawn(app.oneshot(request("simple.jsonl")));
        wait_for_flight_receivers(&state, 2).await;
        initiator.abort();
        initiator.await.expect_err("initiator cancelled");
        release.0.release();

        let response = waiter.await.expect("waiter task").expect("waiter response");
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(invocations.load(Ordering::SeqCst), 1);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn different_keys_execute_independently() {
        let invocations = Arc::new(AtomicUsize::new(0));
        let (gate, release) = blocking_gate();
        let executor: Arc<AnalysisExecutor> = {
            let invocations = Arc::clone(&invocations);
            let gate = Arc::clone(&gate);
            Arc::new(move |_, _, _| {
                invocations.fetch_add(1, Ordering::SeqCst);
                gate.wait();
                Ok(sized_response(9))
            })
        };
        let mut second_session =
            fixture_session("fixtures/pi/compaction.jsonl", "compaction.jsonl");
        second_session.id = "second".into();
        let state = test_state_with_executor(
            vec![
                fixture_session("fixtures/pi/simple.jsonl", "simple.jsonl"),
                second_session,
            ],
            AnalysisConfig {
                tokenization: TokenizationPolicy::Heuristic,
                perf_diagnostics: false,
            },
            Arc::new(Mutex::new(AnalysisCache::default())),
            executor,
        );
        let app = router(state);
        let first = tokio::spawn(app.clone().oneshot(request("simple.jsonl")));
        let second = tokio::spawn(app.oneshot(request("compaction.jsonl")));
        while invocations.load(Ordering::SeqCst) < 2 {
            tokio::task::yield_now().await;
        }
        assert_eq!(invocations.load(Ordering::SeqCst), 2);
        release.0.release();
        assert_eq!(
            first
                .await
                .expect("first task")
                .expect("first response")
                .status(),
            StatusCode::OK
        );
        assert_eq!(
            second
                .await
                .expect("second task")
                .expect("second response")
                .status(),
            StatusCode::OK
        );
    }

    #[tokio::test]
    async fn request_cache_invalidates_after_same_size_file_rewrite() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let directory = std::env::temp_dir().join(format!("tokenplume-cache-{unique}"));
        std_fs::create_dir_all(&directory).expect("temporary directory");
        let path = directory.join("session.jsonl");
        std_fs::copy("fixtures/pi/simple.jsonl", &path).expect("copy fixture");
        let cache = Arc::new(Mutex::new(AnalysisCache::default()));
        let app = router(test_state(
            fixture_session(path.to_string_lossy(), "session.jsonl"),
            AnalysisConfig {
                tokenization: TokenizationPolicy::Heuristic,
                perf_diagnostics: false,
            },
            Arc::clone(&cache),
        ));
        let first = app
            .clone()
            .oneshot(request("session.jsonl"))
            .await
            .expect("first response");
        let first_body = response_body(first).await;
        let contents = std_fs::read_to_string(&path).expect("read fixture copy");
        std_fs::write(&path, contents.replace("hello", "world")).expect("rewrite fixture copy");
        let second = app
            .oneshot(request("session.jsonl"))
            .await
            .expect("second response");
        let second_body = response_body(second).await;
        assert_ne!(first_body, second_body);
        assert_eq!(cache.lock().expect("cache").entries.len(), 2);
        std_fs::remove_dir_all(directory).expect("temporary directory cleanup");
    }

    #[test]
    fn cache_key_tracks_filesystem_fingerprint_and_configuration() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let directory = std::env::temp_dir().join(format!("tokenplume-fingerprint-{unique}"));
        std_fs::create_dir_all(&directory).expect("temporary directory");
        let path = directory.join("session.jsonl");
        std_fs::write(&path, b"abc").expect("initial file");
        let auto = AnalysisConfig {
            tokenization: TokenizationPolicy::Auto,
            perf_diagnostics: false,
        };
        let first = analysis_cache_key(&path, auto).expect("first fingerprint");
        let same_size = (0..20).find_map(|_| {
            thread::sleep(Duration::from_millis(10));
            std_fs::write(&path, b"xyz").expect("same-size rewrite");
            let candidate = analysis_cache_key(&path, auto).expect("rewritten fingerprint");
            (candidate.modified_nanos != first.modified_nanos).then_some(candidate)
        });
        let second = same_size.expect("filesystem modification time changed");
        assert_eq!(first.byte_size, second.byte_size);
        assert_ne!(first.modified_nanos, second.modified_nanos);

        thread::sleep(Duration::from_millis(10));
        std_fs::write(&path, b"longer").expect("size rewrite");
        let third = analysis_cache_key(&path, auto).expect("size fingerprint");
        assert_ne!(second.byte_size, third.byte_size);
        let strict = analysis_cache_key(
            &path,
            AnalysisConfig {
                tokenization: TokenizationPolicy::Strict,
                perf_diagnostics: false,
            },
        )
        .expect("strict fingerprint");
        let diagnostics = analysis_cache_key(
            &path,
            AnalysisConfig {
                tokenization: TokenizationPolicy::Auto,
                perf_diagnostics: true,
            },
        )
        .expect("diagnostic fingerprint");
        assert_ne!(third, strict);
        assert_eq!(third, diagnostics);
        assert_eq!(etag_for_key(&third), etag_for_key(&diagnostics));
        std_fs::remove_dir_all(directory).expect("temporary directory cleanup");
    }

    #[test]
    fn analysis_cache_enforces_entry_and_byte_limits() {
        let path = PathBuf::from("fixtures/pi/simple.jsonl");
        let key = |byte_size| AnalysisCacheKey {
            path: path.clone(),
            byte_size,
            modified_nanos: 0,
            tokenization: TokenizationPolicy::Heuristic,
            schema_version: crate::analysis::ANALYSIS_SCHEMA_VERSION,
            output_version: crate::analysis::ANALYSIS_OUTPUT_VERSION,
        };
        let mut cache = AnalysisCache::with_limits(3, 10);
        cache.insert(key(1), sized_response(6));
        cache.insert(key(2), sized_response(6));
        assert_eq!(cache.entries.len(), 1);
        assert_eq!(cache.bytes, 6);
        cache.insert(key(3), sized_response(11));
        assert_eq!(cache.entries.len(), 1);
        assert!(cache.get(&key(1)).is_none());
    }

    #[test]
    fn analysis_cache_reuses_entries_and_evicts_oldest() {
        let config = AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
        };
        let analysis = analyze(
            PiSourceAdapter
                .parse_path_with_stats(FsPath::new("fixtures/pi/simple.jsonl"))
                .map(|(session, _)| session)
                .expect("fixture"),
            config,
        )
        .expect("analysis");
        let path = PathBuf::from("fixtures/pi/simple.jsonl");
        let key = |byte_size| AnalysisCacheKey {
            path: path.clone(),
            byte_size,
            modified_nanos: 0,
            tokenization: config.tokenization,
            schema_version: crate::analysis::ANALYSIS_SCHEMA_VERSION,
            output_version: crate::analysis::ANALYSIS_OUTPUT_VERSION,
        };
        let mut cache = AnalysisCache::new(2);
        let cached = cached_response(&analysis);
        cache.insert(key(1), Arc::clone(&cached));
        assert!(cache.get(&key(1)).is_some());
        assert!(cache.get(&key(2)).is_none());
        cache.insert(key(2), Arc::clone(&cached));
        cache.insert(key(3), cached);
        assert!(cache.get(&key(1)).is_none());
        assert!(cache.get(&key(2)).is_some());
        assert!(cache.get(&key(3)).is_some());
    }
}
