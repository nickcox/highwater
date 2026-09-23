mod assets;
mod events;
#[path = "watch.rs"]
mod watcher;

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
use events::{LiveAvailability, LiveState};
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    fs::{self, File},
    io::{BufRead, BufReader},
    net::SocketAddr,
    path::{Path as FsPath, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex, RwLock,
    },
    time::{Duration, Instant, UNIX_EPOCH},
};
use thiserror::Error;
use tokio::{
    sync::{mpsc, oneshot, watch},
    task::JoinHandle,
};

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
    catalog: Arc<SessionCatalog>,
    live_state: watch::Sender<LiveState>,
    shutdown: watch::Sender<bool>,
    coordinator: Option<Arc<ScanCoordinator>>,
    config: AnalysisConfig,
    analysis_cache: Arc<Mutex<AnalysisCache>>,
    analysis_flights: Arc<Mutex<HashMap<AnalysisCacheKey, Arc<AnalysisFlight>>>>,
    analysis_executor: Arc<AnalysisExecutor>,
}

#[derive(Debug, Clone)]
struct CatalogSnapshot {
    generation: String,
    revision: u64,
    sessions: Arc<[SessionFile]>,
}

#[derive(Debug)]
struct SessionCatalog {
    snapshot: RwLock<CatalogSnapshot>,
}

impl SessionCatalog {
    fn new(generation: String, sessions: Vec<SessionFile>) -> Self {
        Self {
            snapshot: RwLock::new(CatalogSnapshot {
                generation,
                revision: 0,
                sessions: Arc::from(sessions.into_boxed_slice()),
            }),
        }
    }

    fn snapshot(&self) -> Result<CatalogSnapshot, AppError> {
        self.snapshot
            .read()
            .map(|snapshot| snapshot.clone())
            .map_err(|_| AppError::Message("session catalogue is unavailable".into()))
    }

    fn install(&self, sessions: Vec<SessionFile>) -> Result<bool, AppError> {
        let sessions: Arc<[SessionFile]> = Arc::from(sessions.into_boxed_slice());
        let mut snapshot = self
            .snapshot
            .write()
            .map_err(|_| AppError::Message("session catalogue is unavailable".into()))?;
        if snapshot.sessions.as_ref() == sessions.as_ref() {
            return Ok(false);
        }
        snapshot.revision = snapshot
            .revision
            .checked_add(1)
            .ok_or_else(|| AppError::Message("session catalogue revision exhausted".into()))?;
        snapshot.sessions = sessions;
        Ok(true)
    }
}

#[derive(Debug, Default)]
struct Diagnostics {
    watch_events_received: AtomicU64,
    watch_hints_dropped: AtomicU64,
    watch_refreshes_started: AtomicU64,
    watch_refreshes_changed: AtomicU64,
    watch_refreshes_unchanged: AtomicU64,
    watch_errors: AtomicU64,
    catalogue_refresh_failures: AtomicU64,
    catalogue_refresh_retries: AtomicU64,
    catalogue_degraded_refreshes: AtomicU64,
    catalogue_sessions: AtomicU64,
    catalogue_refresh_ms: AtomicU64,
}

#[derive(Debug)]
struct ScanCoordinator {
    controls: mpsc::Sender<ScanControl>,
}

enum ScanControl {
    EnsureFresh(oneshot::Sender<Result<(), String>>),
    Shutdown,
}

impl ScanCoordinator {
    async fn ensure_fresh(&self) -> Result<(), String> {
        let (sender, receiver) = oneshot::channel();
        self.controls
            .send(ScanControl::EnsureFresh(sender))
            .await
            .map_err(|_| "catalogue refresh is unavailable".to_owned())?;
        receiver
            .await
            .map_err(|_| "catalogue refresh is unavailable".to_owned())?
    }

    async fn shutdown(&self) {
        let _ = self.controls.send(ScanControl::Shutdown).await;
    }
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
    SourceChanged,
    Fingerprint(String),
    Analysis(String),
    Message(String),
}

impl FlightError {
    fn into_app_error(self) -> AppError {
        match self {
            Self::Source(message) => AppError::SourceMessage(message),
            Self::SourceChanged => AppError::SourceChanged,
            Self::Fingerprint(message) => AppError::Fingerprint(message),
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
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
    #[serde(skip)]
    modified_nanos: Option<u128>,
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
    #[error("session changed while it was being analysed")]
    SourceChanged,
    #[error("catalogue refresh is unavailable")]
    CatalogRefreshUnavailable,
    #[error("{0}")]
    Message(String),
    #[error("unknown session")]
    NotFound,
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, code) = match &self {
            Self::NotFound => (StatusCode::NOT_FOUND, "SESSION_NOT_FOUND"),
            Self::SourceChanged => (StatusCode::CONFLICT, "SESSION_SOURCE_CHANGED"),
            Self::Source(_) | Self::SourceMessage(_) => {
                (StatusCode::UNPROCESSABLE_ENTITY, "SESSION_PARSE_FAILED")
            }
            Self::CatalogRefreshUnavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "CATALOG_REFRESH_UNAVAILABLE",
            ),
            _ => (StatusCode::BAD_REQUEST, "SESSION_ANALYSIS_FAILED"),
        };
        (
            status,
            Json(serde_json::json!({ "error": { "code": code, "message": self.to_string() } })),
        )
            .into_response()
    }
}

const HINT_CHANNEL_CAPACITY: usize = 256;
const DEBOUNCE_QUIET: Duration = Duration::from_millis(200);
const DEBOUNCE_MAX: Duration = Duration::from_secs(1);
const RETRY_DELAYS: [Duration; 3] = [
    Duration::from_millis(100),
    Duration::from_millis(250),
    Duration::from_millis(500),
];
const DEGRADED_SCAN_INTERVAL: Duration = Duration::from_secs(1);
const DEGRADED_SCAN_DEADLINE: Duration = Duration::from_secs(5);
const SCAN_SHUTDOWN_DRAIN: Duration = Duration::from_secs(2);

pub(crate) async fn run(args: Args) -> Result<(), Box<dyn std::error::Error>> {
    let configured_root = args.session_root.unwrap_or_else(|| {
        PathBuf::from(std::env::var("HOME").unwrap_or_default()).join(".pi/agent/sessions")
    });
    let root = tokio::task::spawn_blocking(move || canonical_root(&configured_root)).await??;
    let generation = new_generation()?;
    let diagnostics = Arc::new(Diagnostics::default());
    let signals = Arc::new(watcher::WatchSignals::default());
    let (hint_sender, hint_receiver) = mpsc::channel(HINT_CHANNEL_CAPACITY);
    let watcher = watcher::start(&root, hint_sender, Arc::clone(&signals))
        .map_err(|error| format!("cannot watch session root: {error}"))?;

    let initial_root = root.clone();
    let sessions = tokio::task::spawn_blocking(move || discover(&initial_root, None)).await??;
    diagnostics
        .catalogue_sessions
        .store(sessions.len() as u64, Ordering::Relaxed);
    println!("Discovered {} sessions", sessions.len());

    let catalog = Arc::new(SessionCatalog::new(generation.clone(), sessions));
    let (live_state, _live_receiver) = watch::channel(LiveState {
        generation: generation.clone(),
        revision: 0,
        availability: LiveAvailability::Active,
    });
    let (shutdown, _shutdown_receiver) = watch::channel(false);
    let (control_sender, control_receiver) = mpsc::channel(32);
    let coordinator = Arc::new(ScanCoordinator {
        controls: control_sender,
    });
    let worker_catalog = Arc::clone(&catalog);
    let worker_live_state = live_state.clone();
    let worker_root = root.clone();
    let worker_diagnostics = Arc::clone(&diagnostics);
    let worker_signals = Arc::clone(&signals);
    let worker = tokio::spawn(scan_worker(
        worker_root,
        worker_catalog,
        worker_live_state,
        hint_receiver,
        control_receiver,
        worker_signals,
        worker_diagnostics,
    ));

    let perf_diagnostics = args.perf_diagnostics;
    let state = AppState {
        catalog,
        live_state,
        shutdown: shutdown.clone(),
        coordinator: Some(Arc::clone(&coordinator)),
        config: AnalysisConfig {
            tokenization: args.tokenization.into(),
            perf_diagnostics,
        },
        analysis_cache: Arc::new(Mutex::new(AnalysisCache::default())),
        analysis_flights: Arc::new(Mutex::new(HashMap::new())),
        analysis_executor: Arc::new(execute_analysis),
    };
    let app = router(state);
    let address = SocketAddr::from(([127, 0, 0, 1], args.port));
    println!("Listening on http://{address}");
    let listener = tokio::net::TcpListener::bind(address).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(shutdown.clone()))
        .await?;

    coordinator.shutdown().await;
    let _ = tokio::time::timeout(SCAN_SHUTDOWN_DRAIN, worker).await;
    drop(watcher);
    if perf_diagnostics {
        print_diagnostics(&diagnostics);
    }
    Ok(())
}

async fn shutdown_signal(shutdown: watch::Sender<bool>) {
    let _ = tokio::signal::ctrl_c().await;
    shutdown.send_replace(true);
}

fn print_diagnostics(diagnostics: &Diagnostics) {
    eprintln!(
        "live_updates_perf watch_events_received={} watch_hints_dropped={} watch_refreshes_started={} watch_refreshes_changed={} watch_refreshes_unchanged={} watch_errors={} catalogue_refresh_failures={} catalogue_refresh_retries={} catalogue_degraded_refreshes={} catalogue_sessions={} catalogue_refresh_ms={}",
        diagnostics.watch_events_received.load(Ordering::Relaxed),
        diagnostics.watch_hints_dropped.load(Ordering::Relaxed),
        diagnostics.watch_refreshes_started.load(Ordering::Relaxed),
        diagnostics.watch_refreshes_changed.load(Ordering::Relaxed),
        diagnostics.watch_refreshes_unchanged.load(Ordering::Relaxed),
        diagnostics.watch_errors.load(Ordering::Relaxed),
        diagnostics.catalogue_refresh_failures.load(Ordering::Relaxed),
        diagnostics.catalogue_refresh_retries.load(Ordering::Relaxed),
        diagnostics.catalogue_degraded_refreshes.load(Ordering::Relaxed),
        diagnostics.catalogue_sessions.load(Ordering::Relaxed),
        diagnostics.catalogue_refresh_ms.load(Ordering::Relaxed),
    );
}

fn new_generation() -> Result<String, AppError> {
    let mut bytes = [0_u8; 16];
    getrandom::fill(&mut bytes).map_err(|error| AppError::Message(error.to_string()))?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn canonical_root(root: &FsPath) -> Result<PathBuf, AppError> {
    let canonical = fs::canonicalize(root).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            AppError::Message("session root does not exist".into())
        } else {
            AppError::Io(error)
        }
    })?;
    if !fs::metadata(&canonical)?.is_dir() {
        return Err(AppError::Message("session root is not a directory".into()));
    }
    Ok(canonical)
}

fn session_listing_metadata(
    path: &FsPath,
    file_name: &str,
) -> std::io::Result<(String, Option<String>, Option<DateTime<Utc>>)> {
    let first_line = BufReader::new(File::open(path)?)
        .lines()
        .next()
        .transpose()?;
    let header = first_line
        .as_deref()
        .and_then(|line| serde_json::from_str::<Value>(line).ok());
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
    Ok((display_name, working_directory, started_at))
}

#[derive(Debug, thiserror::Error)]
enum ScanError {
    #[error("transient catalogue discovery failure: {0}")]
    Transient(String),
    #[error("catalogue discovery cancelled")]
    Cancelled,
}

fn discover(root: &FsPath, cancelled: Option<&AtomicBool>) -> Result<Vec<SessionFile>, ScanError> {
    let mut output = Vec::new();
    let mut identities = HashSet::new();

    fn walk(
        root: &FsPath,
        path: &FsPath,
        output: &mut Vec<SessionFile>,
        identities: &mut HashSet<PathBuf>,
        cancelled: Option<&AtomicBool>,
    ) -> Result<(), ScanError> {
        if cancelled.is_some_and(|value| value.load(Ordering::Acquire)) {
            return Err(ScanError::Cancelled);
        }
        let entries =
            fs::read_dir(path).map_err(|error| ScanError::Transient(error.to_string()))?;
        for entry in entries {
            if cancelled.is_some_and(|value| value.load(Ordering::Acquire)) {
                return Err(ScanError::Cancelled);
            }
            let entry = entry.map_err(|error| ScanError::Transient(error.to_string()))?;
            let candidate = entry.path();
            let file_type = entry
                .file_type()
                .map_err(|error| ScanError::Transient(error.to_string()))?;
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                walk(root, &candidate, output, identities, cancelled)?;
                continue;
            }
            if !file_type.is_file()
                || candidate
                    .extension()
                    .and_then(|extension| extension.to_str())
                    != Some("jsonl")
            {
                continue;
            }

            let metadata = entry
                .metadata()
                .map_err(|error| ScanError::Transient(error.to_string()))?;
            let before = fs::symlink_metadata(&candidate)
                .map_err(|error| ScanError::Transient(error.to_string()))?;
            if !before.file_type().is_file() {
                return Err(ScanError::Transient(
                    "session entry changed type during discovery".into(),
                ));
            }
            let canonical = fs::canonicalize(&candidate)
                .map_err(|error| ScanError::Transient(error.to_string()))?;
            if !canonical.starts_with(root) {
                return Err(ScanError::Transient(
                    "session entry escaped the watched root".into(),
                ));
            }
            let after = fs::symlink_metadata(&candidate)
                .map_err(|error| ScanError::Transient(error.to_string()))?;
            if !after.file_type().is_file() {
                return Err(ScanError::Transient(
                    "session entry changed type during discovery".into(),
                ));
            }
            if !identities.insert(canonical.clone()) {
                continue;
            }
            let file_name = canonical
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or_default()
                .to_owned();
            let (display_name, working_directory, started_at) =
                session_listing_metadata(&canonical, &file_name)
                    .map_err(|error| ScanError::Transient(error.to_string()))?;
            let modified_nanos = metadata
                .modified()
                .ok()
                .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_nanos());
            output.push(SessionFile {
                id: canonical.to_string_lossy().into_owned(),
                path: canonical.to_string_lossy().into_owned(),
                file_name,
                display_name,
                working_directory,
                started_at,
                byte_size: metadata.len(),
                modified_at: metadata.modified().ok().map(DateTime::<Utc>::from),
                modified_nanos,
            });
        }
        Ok(())
    }

    walk(root, root, &mut output, &mut identities, cancelled)?;
    output.sort_by(|left, right| {
        right
            .modified_nanos
            .cmp(&left.modified_nanos)
            .then_with(|| left.id.cmp(&right.id))
    });
    Ok(output)
}

async fn wait_for_scan(
    active: &mut Option<JoinHandle<Result<Vec<SessionFile>, ScanError>>>,
) -> Result<Vec<SessionFile>, ScanError> {
    let handle = active
        .as_mut()
        .expect("wait_for_scan called without an active scan");
    match handle.await {
        Ok(result) => result,
        Err(error) => Err(ScanError::Transient(format!(
            "catalogue scan task failed: {error}"
        ))),
    }
}

fn publish_live_state(
    catalog: &SessionCatalog,
    live_state: &watch::Sender<LiveState>,
    availability: LiveAvailability,
) {
    if let Ok(snapshot) = catalog.snapshot() {
        live_state.send_replace(LiveState {
            generation: snapshot.generation,
            revision: snapshot.revision,
            availability,
        });
    }
}

fn schedule_hint(
    pending: &mut bool,
    ready: &mut bool,
    quiet_deadline: &mut Option<Instant>,
    maximum_deadline: &mut Option<Instant>,
) {
    *pending = true;
    if !*ready {
        let now = Instant::now();
        *quiet_deadline = Some(now + DEBOUNCE_QUIET);
        maximum_deadline.get_or_insert(now + DEBOUNCE_MAX);
    }
}

async fn scan_worker(
    root: PathBuf,
    catalog: Arc<SessionCatalog>,
    live_state: watch::Sender<LiveState>,
    mut hints: mpsc::Receiver<watcher::WatchHint>,
    mut controls: mpsc::Receiver<ScanControl>,
    signals: Arc<watcher::WatchSignals>,
    diagnostics: Arc<Diagnostics>,
) {
    let cancelled = Arc::new(AtomicBool::new(false));
    let mut active: Option<JoinHandle<Result<Vec<SessionFile>, ScanError>>> = None;
    let mut pending = false;
    let mut ready = false;
    let mut quiet_deadline = None;
    let mut maximum_deadline = None;
    let mut retry_deadline = None;
    let mut retry_index = 0_usize;
    let mut rate_deadline = None;
    let mut last_scan_start = None;
    let mut waiters: Vec<oneshot::Sender<Result<(), String>>> = Vec::new();
    let mut watcher_healthy = true;
    let mut degraded = false;

    loop {
        let received = signals.received.swap(0, Ordering::AcqRel);
        if received > 0 {
            diagnostics
                .watch_events_received
                .fetch_add(received, Ordering::Relaxed);
        }
        let dropped = signals.dropped.swap(0, Ordering::AcqRel);
        if dropped > 0 {
            diagnostics
                .watch_hints_dropped
                .fetch_add(dropped, Ordering::Relaxed);
            schedule_hint(
                &mut pending,
                &mut ready,
                &mut quiet_deadline,
                &mut maximum_deadline,
            );
        }
        if signals.overflow.swap(false, Ordering::AcqRel) {
            schedule_hint(
                &mut pending,
                &mut ready,
                &mut quiet_deadline,
                &mut maximum_deadline,
            );
        }
        if signals.watcher_failed.swap(false, Ordering::AcqRel) {
            watcher_healthy = false;
            diagnostics.watch_errors.fetch_add(1, Ordering::Relaxed);
            if !degraded {
                degraded = true;
                publish_live_state(&catalog, &live_state, LiveAvailability::Degraded);
            }
        }

        if active.is_none() && pending && ready && retry_deadline.is_none() {
            let now = Instant::now();
            if degraded {
                if let Some(last_start) = last_scan_start {
                    let allowed_at = last_start + DEGRADED_SCAN_INTERVAL;
                    if allowed_at > now {
                        rate_deadline = Some(allowed_at);
                    } else {
                        rate_deadline = None;
                    }
                }
            }
            if rate_deadline.is_none() {
                pending = false;
                ready = false;
                quiet_deadline = None;
                maximum_deadline = None;
                last_scan_start = Some(now);
                diagnostics
                    .watch_refreshes_started
                    .fetch_add(1, Ordering::Relaxed);
                let scan_root = root.clone();
                let scan_cancelled = Arc::clone(&cancelled);
                active = Some(tokio::spawn(async move {
                    match tokio::task::spawn_blocking(move || {
                        discover(&scan_root, Some(scan_cancelled.as_ref()))
                    })
                    .await
                    {
                        Ok(result) => result,
                        Err(error) => Err(ScanError::Transient(format!(
                            "catalogue scan task failed: {error}"
                        ))),
                    }
                }));
            }
        }

        let next_deadline = [
            quiet_deadline,
            maximum_deadline,
            retry_deadline,
            rate_deadline,
        ]
        .into_iter()
        .flatten()
        .min();
        let mut timer = Box::pin(match next_deadline {
            Some(deadline) => tokio::time::sleep_until(tokio::time::Instant::from_std(deadline)),
            None => tokio::time::sleep(Duration::from_secs(24 * 60 * 60)),
        });
        let active_result = async {
            if active.is_some() {
                Some(wait_for_scan(&mut active).await)
            } else {
                std::future::pending().await
            }
        };

        tokio::select! {
            biased;
            result = active_result => {
                active = None;
                let elapsed = last_scan_start
                    .map(|started| started.elapsed().as_millis() as u64)
                    .unwrap_or_default();
                diagnostics.catalogue_refresh_ms.fetch_add(elapsed, Ordering::Relaxed);
                match result.expect("active scan result") {
                    Ok(sessions) => {
                        diagnostics.catalogue_sessions.store(sessions.len() as u64, Ordering::Relaxed);
                        match catalog.install(sessions) {
                            Ok(changed) => {
                                if changed {
                                    diagnostics.watch_refreshes_changed.fetch_add(1, Ordering::Relaxed);
                                } else {
                                    diagnostics.watch_refreshes_unchanged.fetch_add(1, Ordering::Relaxed);
                                }
                                if changed || degraded == watcher_healthy {
                                    let next_availability = if watcher_healthy {
                                        LiveAvailability::Active
                                    } else {
                                        LiveAvailability::Degraded
                                    };
                                    publish_live_state(&catalog, &live_state, next_availability);
                                }
                                if watcher_healthy {
                                    degraded = false;
                                }
                                retry_index = 0;
                                retry_deadline = None;
                                for waiter in waiters.drain(..) {
                                    let _ = waiter.send(Ok(()));
                                }
                                if pending {
                                    ready = true;
                                }
                            }
                            Err(error) => {
                                diagnostics.catalogue_refresh_failures.fetch_add(1, Ordering::Relaxed);
                                if retry_index < RETRY_DELAYS.len() {
                                    retry_deadline = Some(Instant::now() + RETRY_DELAYS[retry_index]);
                                    retry_index += 1;
                                    diagnostics.catalogue_refresh_retries.fetch_add(1, Ordering::Relaxed);
                                    pending = true;
                                    ready = false;
                                } else {
                                    retry_index = 0;
                                    retry_deadline = None;
                                    pending = false;
                                    ready = false;
                                    quiet_deadline = None;
                                    maximum_deadline = None;
                                    degraded = true;
                                    diagnostics.catalogue_degraded_refreshes.fetch_add(1, Ordering::Relaxed);
                                    publish_live_state(&catalog, &live_state, LiveAvailability::Degraded);
                                    let message = error.to_string();
                                    for waiter in waiters.drain(..) {
                                        let _ = waiter.send(Err(message.clone()));
                                    }
                                }
                            }
                        }
                    }
                    Err(ScanError::Cancelled) => break,
                    Err(error) => {
                        diagnostics.catalogue_refresh_failures.fetch_add(1, Ordering::Relaxed);
                        if retry_index < RETRY_DELAYS.len() {
                            retry_deadline = Some(Instant::now() + RETRY_DELAYS[retry_index]);
                            retry_index += 1;
                            diagnostics.catalogue_refresh_retries.fetch_add(1, Ordering::Relaxed);
                            pending = true;
                            ready = false;
                        } else {
                            retry_index = 0;
                            retry_deadline = None;
                            pending = false;
                            ready = false;
                            quiet_deadline = None;
                            maximum_deadline = None;
                            degraded = true;
                            diagnostics.catalogue_degraded_refreshes.fetch_add(1, Ordering::Relaxed);
                            publish_live_state(&catalog, &live_state, LiveAvailability::Degraded);
                            let message = error.to_string();
                            for waiter in waiters.drain(..) {
                                let _ = waiter.send(Err(message.clone()));
                            }
                        }
                    }
                }
            }
            control = controls.recv() => {
                match control {
                    Some(ScanControl::EnsureFresh(waiter)) => {
                        waiters.push(waiter);
                        pending = true;
                        ready = true;
                        quiet_deadline = None;
                        maximum_deadline = None;
                        diagnostics.catalogue_degraded_refreshes.fetch_add(1, Ordering::Relaxed);
                    }
                    Some(ScanControl::Shutdown) | None => {
                        cancelled.store(true, Ordering::Release);
                        for waiter in waiters.drain(..) {
                            let _ = waiter.send(Err("catalogue refresh is shutting down".into()));
                        }
                        if active.is_some() {
                            let _ = tokio::time::timeout(SCAN_SHUTDOWN_DRAIN, wait_for_scan(&mut active)).await;
                        }
                        break;
                    }
                }
            }
            Some(hint) = hints.recv() => {
                match hint {
                    watcher::WatchHint::Filesystem => schedule_hint(
                        &mut pending,
                        &mut ready,
                        &mut quiet_deadline,
                        &mut maximum_deadline,
                    ),
                }
            }
            _ = signals.wake.notified() => {}
            _ = &mut timer => {
                let now = Instant::now();
                if quiet_deadline.is_some_and(|deadline| deadline <= now)
                    || maximum_deadline.is_some_and(|deadline| deadline <= now)
                {
                    quiet_deadline = None;
                    maximum_deadline = None;
                    ready = true;
                }
                if retry_deadline.is_some_and(|deadline| deadline <= now) {
                    retry_deadline = None;
                    ready = true;
                    pending = true;
                }
                if rate_deadline.is_some_and(|deadline| deadline <= now) {
                    rate_deadline = None;
                }
            }
        }
    }
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
        .route("/api/events", get(events::handler))
        .route("/api/sessions/{id}/analysis", get(session_analysis))
        .fallback(assets::static_file)
        .with_state(state)
}

async fn sessions(State(state): State<AppState>, headers: HeaderMap) -> Result<Response, AppError> {
    if state.live_state.borrow().availability == LiveAvailability::Degraded {
        let coordinator = state
            .coordinator
            .as_ref()
            .ok_or(AppError::CatalogRefreshUnavailable)?;
        tokio::time::timeout(DEGRADED_SCAN_DEADLINE, coordinator.ensure_fresh())
            .await
            .map_err(|_| AppError::CatalogRefreshUnavailable)?
            .map_err(|_| AppError::CatalogRefreshUnavailable)?;
    }
    let snapshot = state.catalog.snapshot()?;
    let availability = state.live_state.borrow().availability;
    list_response(&snapshot, availability, &headers)
}

fn list_response(
    snapshot: &CatalogSnapshot,
    availability: LiveAvailability,
    headers: &HeaderMap,
) -> Result<Response, AppError> {
    let body = serde_json::to_vec(&serde_json::json!({ "sessions": &*snapshot.sessions }))
        .map_err(|error| {
            AppError::Message(format!("cannot serialize session catalogue: {error}"))
        })?;
    let etag = list_etag(snapshot);
    let mut builder = Response::builder()
        .header(header::ETAG, etag.as_str())
        .header(
            "X-TokenPlume-Server-Generation",
            snapshot.generation.as_str(),
        )
        .header(
            "X-TokenPlume-Catalog-Revision",
            snapshot.revision.to_string(),
        )
        .header(
            "X-TokenPlume-Live-Updates",
            availability_header(availability),
        );
    let matches = headers
        .get(header::IF_NONE_MATCH)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.split(',').any(|candidate| candidate.trim() == etag));
    if matches {
        return builder
            .status(StatusCode::NOT_MODIFIED)
            .body(axum::body::Body::empty())
            .map_err(|error| AppError::Message(format!("cannot build response: {error}")));
    }
    builder = builder
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::CONTENT_LENGTH, body.len());
    builder
        .status(StatusCode::OK)
        .body(axum::body::Body::from(body))
        .map_err(|error| AppError::Message(format!("cannot build response: {error}")))
}

fn availability_header(availability: LiveAvailability) -> &'static str {
    match availability {
        LiveAvailability::Active => "active",
        LiveAvailability::Degraded => "degraded",
    }
}

fn list_etag(snapshot: &CatalogSnapshot) -> String {
    let mut hasher = blake3::Hasher::new();
    hasher.update(snapshot.generation.as_bytes());
    hasher.update(&snapshot.revision.to_le_bytes());
    format!("\"{}\"", hasher.finalize().to_hex())
}

async fn session_analysis(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let snapshot = state.catalog.snapshot()?;
    let session = snapshot
        .sessions
        .iter()
        .find(|session| session.id == id)
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
    let source_bytes = response_key.byte_size;
    let parse_started = Instant::now();
    let parsed = PiSourceAdapter.parse_path_with_stats(&path);
    let (normalized, parse_stats) = match parsed {
        Ok(value) => value,
        Err(error) => {
            if matches!(fingerprint_matches(&path, &response_key), Ok(false)) {
                return Err(FlightError::SourceChanged);
            }
            return Err(FlightError::Source(error.to_string()));
        }
    };
    let parse_ms = parse_started.elapsed().as_secs_f64() * 1000.0;
    let analysis_started = Instant::now();
    let analysis =
        analyze(normalized, config).map_err(|error| FlightError::Analysis(error.to_string()))?;
    let analysis_ms = analysis_started.elapsed().as_secs_f64() * 1000.0;
    let serialization_started = Instant::now();
    let body =
        serde_json::to_vec(&analysis).map_err(|error| FlightError::Message(error.to_string()))?;
    match fingerprint_matches(&path, &response_key)? {
        true => {}
        false => return Err(FlightError::SourceChanged),
    }
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

fn fingerprint_matches(path: &FsPath, key: &AnalysisCacheKey) -> Result<bool, FlightError> {
    let metadata =
        fs::metadata(path).map_err(|error| FlightError::Fingerprint(error.to_string()))?;
    let modified_nanos = metadata
        .modified()
        .map_err(|error| FlightError::Fingerprint(error.to_string()))?
        .duration_since(UNIX_EPOCH)
        .map_err(|error| FlightError::Fingerprint(error.to_string()))?
        .as_nanos();
    Ok(metadata.len() == key.byte_size && modified_nanos == key.modified_nanos)
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
        let path = path.into();
        let file_name = file_name.into();
        SessionFile {
            id: file_name.clone(),
            path,
            file_name,
            display_name: "fixture".into(),
            working_directory: None,
            started_at: None,
            byte_size: 1,
            modified_at: None,
            modified_nanos: None,
        }
    }

    fn request(file_name: &str) -> axum::http::Request<axum::body::Body> {
        axum::http::Request::builder()
            .uri(format!("/api/sessions/{file_name}/analysis"))
            .body(axum::body::Body::empty())
            .expect("request")
    }

    fn canonical_request(path: &FsPath) -> axum::http::Request<axum::body::Body> {
        let encoded = path.to_string_lossy().replace('/', "%2F");
        request(&encoded)
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
        let generation = "0123456789abcdef0123456789abcdef".to_owned();
        let catalog = Arc::new(SessionCatalog::new(generation.clone(), sessions));
        let (live_state, _receiver) = watch::channel(LiveState {
            generation,
            revision: 0,
            availability: LiveAvailability::Active,
        });
        let (shutdown, _shutdown_receiver) = watch::channel(false);
        AppState {
            catalog,
            live_state,
            shutdown,
            coordinator: None,
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
    async fn list_response_has_generation_scoped_headers_and_etag() {
        let app = router(test_state(
            fixture_session("fixtures/pi/simple.jsonl", "simple.jsonl"),
            AnalysisConfig {
                tokenization: TokenizationPolicy::Heuristic,
                perf_diagnostics: false,
            },
            Arc::new(Mutex::new(AnalysisCache::default())),
        ));
        let response = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .uri("/api/sessions")
                    .body(axum::body::Body::empty())
                    .expect("request"),
            )
            .await
            .expect("list response");
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()["X-TokenPlume-Catalog-Revision"], "0");
        assert_eq!(response.headers()["X-TokenPlume-Live-Updates"], "active");
        let etag = response.headers()[header::ETAG].clone();
        let mut conditional = axum::http::Request::builder()
            .uri("/api/sessions")
            .body(axum::body::Body::empty())
            .expect("request");
        conditional
            .headers_mut()
            .insert(header::IF_NONE_MATCH, etag);
        let not_modified = app
            .oneshot(conditional)
            .await
            .expect("conditional list response");
        assert_eq!(not_modified.status(), StatusCode::NOT_MODIFIED);
        assert!(not_modified.headers().contains_key(header::ETAG));
        assert!(not_modified
            .headers()
            .contains_key("X-TokenPlume-Server-Generation"));
    }

    #[tokio::test]
    async fn canonical_path_ids_are_resolved_without_filename_fallback() {
        let path = std_fs::canonicalize("fixtures/pi/simple.jsonl").expect("canonical fixture");
        let mut session = fixture_session(path.to_string_lossy(), "simple.jsonl");
        session.id = path.to_string_lossy().into_owned();
        let app = router(test_state(
            session,
            AnalysisConfig {
                tokenization: TokenizationPolicy::Heuristic,
                perf_diagnostics: false,
            },
            Arc::new(Mutex::new(AnalysisCache::default())),
        ));
        let response = app
            .oneshot(canonical_request(&path))
            .await
            .expect("canonical analysis response");
        assert_eq!(response.status(), StatusCode::OK);
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
        let second = tokio::spawn(app.oneshot(request("second")));
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
    fn analysis_rejects_a_source_changed_after_the_initial_fingerprint() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let directory = std_fs::canonicalize(std::env::temp_dir())
            .expect("temporary directory")
            .join(format!("tokenplume-source-change-{unique}"));
        std_fs::create_dir_all(&directory).expect("temporary directory");
        let path = directory.join("session.jsonl");
        std_fs::copy("fixtures/pi/simple.jsonl", &path).expect("copy fixture");
        let config = AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
        };
        let key = analysis_cache_key(&path, config).expect("initial fingerprint");
        let original = std_fs::read_to_string(&path).expect("read fixture copy");
        let changed = original.replace("hello", "world");
        for _ in 0..20 {
            thread::sleep(Duration::from_millis(10));
            std_fs::write(&path, &changed).expect("rewrite fixture copy");
            if analysis_cache_key(&path, config)
                .map(|candidate| candidate.modified_nanos != key.modified_nanos)
                .unwrap_or(false)
            {
                break;
            }
        }
        let result = execute_analysis(path.clone(), config, key);
        assert!(matches!(result, Err(FlightError::SourceChanged)));
        std_fs::remove_dir_all(directory).expect("temporary directory cleanup");
    }

    #[test]
    fn analysis_publishes_a_stable_response() {
        let path = std_fs::canonicalize("fixtures/pi/simple.jsonl").expect("fixture");
        let config = AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
        };
        let key = analysis_cache_key(&path, config).expect("fingerprint");
        let response = execute_analysis(path, config, key).expect("stable analysis");
        assert!(!response.body.is_empty());
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
