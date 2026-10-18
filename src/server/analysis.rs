use super::error::FlightError;
use crate::{
    analysis::{analyze, AnalysisConfig, TokenizationPolicy},
    claude_code::FileKind,
    source::{self, SessionLocator},
};
use std::{
    collections::HashMap,
    fs,
    io::Write,
    panic::{catch_unwind, AssertUnwindSafe},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Instant, UNIX_EPOCH},
};
use tokio::sync::{watch, Semaphore};

#[cfg(test)]
mod tests;

pub(super) type AnalysisExecutor = dyn Fn(PathBuf, AnalysisConfig, AnalysisCacheKey) -> Result<Arc<CachedResponse>, FlightError>
    + Send
    + Sync;
type FailureReporter = dyn Fn(&FlightError) + Send + Sync;
type SharedResult = Result<Arc<CachedResponse>, Arc<FlightError>>;

fn write_failure_diagnostic(writer: &mut impl Write, error: &FlightError) {
    // Diagnostics must not turn an operational failure into a panic (e.g. closed stderr).
    let _ = writeln!(writer, "{}", error.safe_diagnostic());
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(super) struct AnalysisCacheKey {
    pub path: PathBuf,
    pub database_revision: Option<(String, [u8; 32])>,
    pub byte_size: u64,
    pub modified_nanos: u128,
    /// Which reader opens the file. OpenCode databases use `Pi`, which adds nothing
    /// to the ETag, so Pi and OpenCode keys and ETags are unchanged.
    pub reader: FileReader,
    pub tokenization: TokenizationPolicy,
    pub schema_version: u32,
    pub output_version: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(super) enum FileReader {
    Pi,
    ClaudeCode(FileKind),
    VsCodeCopilot,
    Codex,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct DatabaseFlightKey {
    database: PathBuf,
    native_id: String,
    tokenization: TokenizationPolicy,
}

#[derive(Debug)]
pub(super) struct CachedResponse {
    pub body: bytes::Bytes,
    pub etag: String,
    pub approximate_bytes: usize,
}
#[derive(Debug)]
pub(super) struct CachedEntry {
    last_used: u64,
    response: Arc<CachedResponse>,
}
#[derive(Debug)]
pub(super) struct AnalysisFlight {
    pub result: watch::Sender<Option<SharedResult>>,
}

/// One state lock owns ready entries and active flights, including all cache
/// bookkeeping. The extra Arc permits read-only lifecycle inspection in tests.
#[derive(Debug)]
pub(super) struct AnalysisState {
    pub entries: HashMap<AnalysisCacheKey, CachedEntry>,
    pub flights: HashMap<AnalysisCacheKey, Arc<AnalysisFlight>>,
    database_flights: HashMap<DatabaseFlightKey, Arc<AnalysisFlight>>,
    clock: u64,
    capacity: usize,
    byte_capacity: usize,
    pub bytes: usize,
    pub hits: u64,
    pub evictions: u64,
}
#[cfg(test)]
pub(super) type AnalysisCache = AnalysisState;

impl Default for AnalysisState {
    fn default() -> Self {
        Self::with_limits(4, 16 * 1024 * 1024)
    }
}
impl AnalysisState {
    #[cfg(test)]
    pub fn new(capacity: usize) -> Self {
        Self::with_limits(capacity, 16 * 1024 * 1024)
    }
    pub fn with_limits(capacity: usize, byte_capacity: usize) -> Self {
        Self {
            entries: HashMap::new(),
            flights: HashMap::new(),
            database_flights: HashMap::new(),
            clock: 0,
            capacity: capacity.max(1),
            byte_capacity: byte_capacity.max(1),
            bytes: 0,
            hits: 0,
            evictions: 0,
        }
    }
    pub fn get(&mut self, key: &AnalysisCacheKey) -> Option<Arc<CachedResponse>> {
        self.clock = self.clock.saturating_add(1);
        let cached = self.entries.get_mut(key)?;
        self.hits = self.hits.saturating_add(1);
        cached.last_used = self.clock;
        Some(Arc::clone(&cached.response))
    }
    pub fn insert(&mut self, key: AnalysisCacheKey, response: Arc<CachedResponse>) {
        if response.approximate_bytes > self.byte_capacity {
            return;
        }
        if let Some(previous) = self.entries.remove(&key) {
            self.bytes = self
                .bytes
                .saturating_sub(previous.response.approximate_bytes);
        }
        self.clock = self.clock.saturating_add(1);
        self.bytes = self.bytes.saturating_add(response.approximate_bytes);
        self.entries.insert(
            key,
            CachedEntry {
                last_used: self.clock,
                response,
            },
        );
        while self.entries.len() > self.capacity || self.bytes > self.byte_capacity {
            let Some(oldest) = self
                .entries
                .iter()
                .min_by_key(|(_, cached)| cached.last_used)
                .map(|(key, _)| key.clone())
            else {
                break;
            };
            if let Some(entry) = self.entries.remove(&oldest) {
                self.bytes = self.bytes.saturating_sub(entry.response.approximate_bytes);
                self.evictions = self.evictions.saturating_add(1);
            }
        }
    }
}

pub(super) struct AnalysisService {
    pub state: Arc<Mutex<AnalysisState>>,
    pub permits: Arc<Semaphore>,
    executor: Arc<AnalysisExecutor>,
    reporter: Arc<FailureReporter>,
}
impl AnalysisService {
    pub fn new(executor: Arc<AnalysisExecutor>) -> Self {
        Self::with_state(Arc::new(Mutex::new(AnalysisState::default())), executor)
    }
    pub fn with_state(state: Arc<Mutex<AnalysisState>>, executor: Arc<AnalysisExecutor>) -> Self {
        Self {
            state,
            permits: Arc::new(Semaphore::new(super::ANALYSIS_CONCURRENCY_LIMIT)),
            executor,
            reporter: Arc::new(|error| {
                write_failure_diagnostic(&mut std::io::stderr().lock(), error)
            }),
        }
    }
    #[cfg(test)]
    pub fn with_reporter(mut self, reporter: Arc<FailureReporter>) -> Self {
        self.reporter = reporter;
        self
    }

    fn report_failure(&self, error: &FlightError) {
        // A reporter is ancillary, including injected reporters that unwind.
        // Never attempt another diagnostic here: the original sink may be broken.
        let _ = catch_unwind(AssertUnwindSafe(|| (self.reporter)(error)));
    }

    pub async fn response_source(
        self: &Arc<Self>,
        locator: SessionLocator,
        config: AnalysisConfig,
    ) -> SharedResult {
        match locator {
            SessionLocator::PiFile(path) => self.response(path, config).await,
            SessionLocator::ClaudeCodeFile { path, kind } => {
                self.response_file(path, FileReader::ClaudeCode(kind), config)
                    .await
            }
            SessionLocator::VsCodeCopilotFile { path } => {
                self.response_file(path, FileReader::VsCodeCopilot, config)
                    .await
            }
            SessionLocator::CodexFile { path } => {
                self.response_file(path, FileReader::Codex, config).await
            }
            SessionLocator::OpenCode {
                database,
                native_id,
            } => {
                let key = DatabaseFlightKey {
                    database,
                    native_id,
                    tokenization: config.tokenization,
                };
                let (flight, start) = {
                    let mut state = self
                        .state
                        .lock()
                        .map_err(|_| Arc::new(FlightError::Unavailable))?;
                    if let Some(flight) = state.database_flights.get(&key) {
                        (Arc::clone(flight), false)
                    } else {
                        let (result, _) = watch::channel(None);
                        let flight = Arc::new(AnalysisFlight { result });
                        state
                            .database_flights
                            .insert(key.clone(), Arc::clone(&flight));
                        (flight, true)
                    }
                };
                if start {
                    self.start_database(key, config, Arc::clone(&flight));
                }
                wait_for_flight(flight).await
            }
        }
    }

    fn start_database(
        self: &Arc<Self>,
        key: DatabaseFlightKey,
        config: AnalysisConfig,
        flight: Arc<AnalysisFlight>,
    ) {
        let service = Arc::clone(self);
        tokio::spawn(async move {
            let result = match Arc::clone(&service.permits).acquire_owned().await {
                Ok(permit) => {
                    let worker_service = Arc::clone(&service);
                    let worker_key = key.clone();
                    match tokio::task::spawn_blocking(move || {
                        let _permit = permit;
                        worker_service.database_response(&worker_key, config)
                    })
                    .await
                    {
                        Ok(result) => result.map_err(Arc::new),
                        Err(error) => Err(Arc::new(FlightError::Task(error))),
                    }
                }
                Err(_) => Err(Arc::new(FlightError::Unavailable)),
            };
            let failure = result.as_ref().err().cloned();
            if let Ok(mut state) = service.state.lock() {
                flight.result.send_replace(Some(result));
                state.database_flights.remove(&key);
            } else {
                flight.result.send_replace(Some(result));
            }
            if let Some(error) = failure {
                service.report_failure(&error);
            }
        });
    }

    fn database_response(
        &self,
        locator: &DatabaseFlightKey,
        config: AnalysisConfig,
    ) -> Result<Arc<CachedResponse>, FlightError> {
        use crate::{
            opencode::{replay, storage, usage::OutputAccounting},
            source::LoadError,
        };
        // Every request revalidates against a committed snapshot BEFORE a cache
        // hit or 304. Database mtime/size and WAL notifications are not authority.
        let snapshot_started = Instant::now();
        let snapshot = storage::load_session(&locator.database, &locator.native_id, None)
            .map_err(LoadError::Storage)
            .map_err(FlightError::from)?;
        if config.perf_diagnostics {
            eprintln!(
                "opencode_snapshot_perf snapshot_ms={:.3} source_bytes={} messages={} parts={}",
                snapshot_started.elapsed().as_secs_f64() * 1000.0,
                snapshot.source_bytes,
                snapshot.messages.len(),
                snapshot
                    .messages
                    .iter()
                    .map(|message| message.parts.len())
                    .sum::<usize>(),
            );
        }
        let key = AnalysisCacheKey {
            path: locator.database.clone(),
            database_revision: Some((locator.native_id.clone(), *snapshot.revision.as_bytes())),
            byte_size: 0,
            modified_nanos: 0,
            reader: FileReader::Pi,
            tokenization: config.tokenization,
            schema_version: crate::analysis::ANALYSIS_SCHEMA_VERSION,
            output_version: crate::analysis::ANALYSIS_OUTPUT_VERSION,
        };
        if let Some(response) = self
            .state
            .lock()
            .map_err(|_| FlightError::Unavailable)?
            .get(&key)
        {
            return Ok(response);
        }
        let replay = replay::reconstruct(snapshot, OutputAccounting::Unknown)
            .map_err(LoadError::Replay)
            .map_err(FlightError::from)?;
        let analysis =
            source::analyze_reconstructed(replay, config).map_err(FlightError::Analysis)?;
        let body = serde_json::to_vec(&analysis).map_err(FlightError::Serialization)?;
        let response = Arc::new(CachedResponse {
            approximate_bytes: body.len(),
            body: bytes::Bytes::from(body),
            etag: etag_for_key(&key),
        });
        self.state
            .lock()
            .map_err(|_| FlightError::Unavailable)?
            .insert(key, Arc::clone(&response));
        Ok(response)
    }

    pub async fn response(self: &Arc<Self>, path: PathBuf, config: AnalysisConfig) -> SharedResult {
        self.response_file(path, FileReader::Pi, config).await
    }

    /// Pi files, Claude Code transcripts and Copilot Chat sessions share the size and
    /// modification time fingerprint; `reader` says which reader the executor uses.
    async fn response_file(
        self: &Arc<Self>,
        path: PathBuf,
        reader: FileReader,
        config: AnalysisConfig,
    ) -> SharedResult {
        let key_path = path.clone();
        let key_result =
            tokio::task::spawn_blocking(move || file_cache_key(&key_path, reader, config))
                .await
                .map_err(FlightError::Task)
                .and_then(|result| result);
        let key = match key_result {
            Ok(key) => key,
            Err(error) => {
                self.report_failure(&error);
                return Err(Arc::new(error));
            }
        };
        // No await or HTTP/JSON work under this lock. Registration precedes
        // permit acquisition, so same-key queued requests already have a flight.
        let (flight, start) = {
            let mut state = self
                .state
                .lock()
                .map_err(|_| Arc::new(FlightError::Unavailable))?;
            if let Some(response) = state.get(&key) {
                return Ok(response);
            }
            if let Some(flight) = state.flights.get(&key) {
                (Arc::clone(flight), false)
            } else {
                let (result, _) = watch::channel(None);
                let flight = Arc::new(AnalysisFlight { result });
                state.flights.insert(key.clone(), Arc::clone(&flight));
                (flight, true)
            }
        };
        if start {
            self.start(key, path, config, Arc::clone(&flight));
        }
        let mut receiver = flight.result.subscribe();
        let current = receiver.borrow().clone();
        if let Some(result) = current {
            return result;
        }
        receiver
            .changed()
            .await
            .map_err(|_| Arc::new(FlightError::Unavailable))?;
        let result = receiver
            .borrow()
            .clone()
            .ok_or_else(|| Arc::new(FlightError::Unavailable))?;
        result
    }

    fn start(
        self: &Arc<Self>,
        key: AnalysisCacheKey,
        path: PathBuf,
        config: AnalysisConfig,
        flight: Arc<AnalysisFlight>,
    ) {
        let service = Arc::clone(self);
        // Independent supervision survives initiating-request cancellation.
        tokio::spawn(async move {
            let result = match Arc::clone(&service.permits).acquire_owned().await {
                Ok(permit) => {
                    let executor = Arc::clone(&service.executor);
                    let response_key = key.clone();
                    match tokio::task::spawn_blocking(move || {
                        let _permit = permit; // Held by actual blocking work, including unwind.
                        executor(path, config, response_key)
                    })
                    .await
                    {
                        Ok(result) => result.map_err(Arc::new),
                        Err(error) => Err(Arc::new(FlightError::Task(error))),
                    }
                }
                Err(_) => Err(Arc::new(FlightError::Unavailable)),
            };
            let failure = result.as_ref().err().cloned();
            // Insert, publish, remove in one state-lock transaction. Existing
            // handles retain the published result. After oversized-result removal,
            // a subsequent request deliberately starts a new uncached flight.
            if let Ok(mut state) = service.state.lock() {
                if let Ok(response) = &result {
                    state.insert(key.clone(), Arc::clone(response));
                }
                flight.result.send_replace(Some(result));
                state.flights.remove(&key);
            } else {
                flight.result.send_replace(Some(result));
            }
            // Complete the lifecycle before optional reporting, outside the state lock.
            if let Some(error) = failure {
                service.report_failure(&error);
            }
        });
    }
}

async fn wait_for_flight(flight: Arc<AnalysisFlight>) -> SharedResult {
    let mut receiver = flight.result.subscribe();
    if let Some(result) = receiver.borrow().clone() {
        return result;
    }
    receiver
        .changed()
        .await
        .map_err(|_| Arc::new(FlightError::Unavailable))?;
    let result = receiver
        .borrow()
        .clone()
        .ok_or_else(|| Arc::new(FlightError::Unavailable))?;
    result
}

/// The key for a Pi file.
#[cfg(test)]
pub(super) fn analysis_cache_key(
    path: &Path,
    config: AnalysisConfig,
) -> Result<AnalysisCacheKey, FlightError> {
    file_cache_key(path, FileReader::Pi, config)
}

/// Size/mtime identity deliberately preserves the existing cache contract; it
/// cannot detect a rewrite that preserves both values. Never call on async workers.
pub(super) fn file_cache_key(
    path: &Path,
    reader: FileReader,
    config: AnalysisConfig,
) -> Result<AnalysisCacheKey, FlightError> {
    let metadata = fs::metadata(path).map_err(FlightError::Io)?;
    let modified_nanos = metadata
        .modified()
        .map_err(FlightError::Io)?
        .duration_since(UNIX_EPOCH)
        .map_err(FlightError::Fingerprint)?
        .as_nanos();
    let canonical_path = fs::canonicalize(path).map_err(FlightError::Io)?;
    // A Copilot session's analysis also reads its trace database.
    let database_revision = match reader {
        FileReader::VsCodeCopilot => crate::vscode_copilot::traces::database_for(&canonical_path)
            .map(|database| {
                (
                    "vscode-copilot-traces".to_owned(),
                    crate::vscode_copilot::traces::fingerprint(&database),
                )
            }),
        _ => None,
    };
    Ok(AnalysisCacheKey {
        path: canonical_path,
        database_revision,
        byte_size: metadata.len(),
        modified_nanos,
        reader,
        tokenization: config.tokenization,
        schema_version: crate::analysis::ANALYSIS_SCHEMA_VERSION,
        output_version: crate::analysis::ANALYSIS_OUTPUT_VERSION,
    })
}

pub(super) fn execute_analysis(
    path: PathBuf,
    config: AnalysisConfig,
    response_key: AnalysisCacheKey,
) -> Result<Arc<CachedResponse>, FlightError> {
    let source_bytes = response_key.byte_size;
    let started = Instant::now();
    let locator = match response_key.reader {
        FileReader::Pi => SessionLocator::PiFile(path.clone()),
        FileReader::ClaudeCode(kind) => SessionLocator::ClaudeCodeFile {
            path: path.clone(),
            kind,
        },
        FileReader::VsCodeCopilot => SessionLocator::VsCodeCopilotFile { path: path.clone() },
        FileReader::Codex => SessionLocator::CodexFile { path: path.clone() },
    };
    let loaded = match source::load(&locator, None) {
        Ok(value) => value,
        Err(error) => {
            return Err(classify_parse_failure(
                &path,
                &response_key,
                FlightError::from(error),
            ))
        }
    };
    let parse_ms = started.elapsed().as_secs_f64() * 1000.0;
    let started = Instant::now();
    let mut analysis = analyze(loaded.normalized, config).map_err(FlightError::Analysis)?;
    if let Some(codes) = loaded.coverage_codes {
        analysis.reconstruction = Some(crate::api::ReconstructionCoverage {
            status: "partial",
            explanation_codes: codes,
        });
    }
    let analysis_ms = started.elapsed().as_secs_f64() * 1000.0;
    let started = Instant::now();
    let body = serde_json::to_vec(&analysis).map_err(FlightError::Serialization)?;
    if !fingerprint_matches(&path, &response_key)? {
        return Err(FlightError::SourceChanged);
    }
    if config.perf_diagnostics {
        eprintln!("analysis_perf parse_ms={parse_ms:.3} analyze_ms={analysis_ms:.3} serialize_ms={:.3} source_bytes={source_bytes} response_bytes={} entries={} selected_entries={} calls={} items={} presences={}",
            started.elapsed().as_secs_f64() * 1000.0, body.len(), loaded.stats.records, loaded.stats.selected_records,
            analysis.model_calls.len(), analysis.context_items.len(), analysis.context_items.iter().map(|item| item.presence_call_count).sum::<usize>());
    }
    Ok(Arc::new(CachedResponse {
        approximate_bytes: body.len(),
        body: bytes::Bytes::from(body),
        etag: etag_for_key(&response_key),
    }))
}

pub(super) fn classify_parse_failure(
    path: &Path,
    key: &AnalysisCacheKey,
    parse_failure: FlightError,
) -> FlightError {
    match fingerprint_matches(path, key) {
        Ok(true) => parse_failure,
        Ok(false) => FlightError::SourceChanged,
        Err(error) => error,
    }
}
fn fingerprint_matches(path: &Path, key: &AnalysisCacheKey) -> Result<bool, FlightError> {
    let metadata = fs::metadata(path).map_err(FlightError::Io)?;
    let modified_nanos = metadata
        .modified()
        .map_err(FlightError::Io)?
        .duration_since(UNIX_EPOCH)
        .map_err(FlightError::Fingerprint)?
        .as_nanos();
    Ok(metadata.len() == key.byte_size && modified_nanos == key.modified_nanos)
}
pub(super) fn etag_for_key(key: &AnalysisCacheKey) -> String {
    let mut hasher = blake3::Hasher::new();
    hasher.update(key.path.to_string_lossy().as_bytes());
    if let Some((native_id, revision)) = &key.database_revision {
        hasher.update(b"\0opencode\0");
        hasher.update(&(native_id.len() as u64).to_le_bytes());
        hasher.update(native_id.as_bytes());
        hasher.update(revision);
    }
    match key.reader {
        FileReader::Pi => {}
        FileReader::ClaudeCode(kind) => {
            hasher.update(b"\0claude-code\0");
            hasher.update(match kind {
                FileKind::Main => b"main",
                FileKind::Subagent => b"agent",
            });
        }
        FileReader::VsCodeCopilot => {
            hasher.update(b"\0vscode-copilot\0");
        }
        FileReader::Codex => {
            hasher.update(b"\0codex\0");
        }
    }
    hasher.update(&key.byte_size.to_le_bytes());
    hasher.update(&key.modified_nanos.to_le_bytes());
    hasher.update(key.tokenization.as_str().as_bytes());
    hasher.update(&key.schema_version.to_le_bytes());
    hasher.update(&key.output_version.to_le_bytes());
    format!("\"{}\"", hasher.finalize().to_hex())
}
