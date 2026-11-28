use super::error::FlightError;
use crate::{
    analysis::{analyze, AnalysisConfig, TokenizationPolicy},
    claude_code::FileKind,
    source::{self, FileLocator, FileReader, SessionLocator},
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

pub(super) type AnalysisExecutor = dyn Fn(FileLocator, AnalysisConfig, FileAnalysisKey) -> Result<Arc<CachedResponse>, FlightError>
    + Send
    + Sync;
type FailureReporter = dyn Fn(&FlightError) + Send + Sync;
type SharedResult = Result<Arc<CachedResponse>, Arc<FlightError>>;

fn write_failure_diagnostic(writer: &mut impl Write, error: &FlightError) {
    // Diagnostics must not turn an operational failure into a panic (e.g. closed stderr).
    let _ = writeln!(writer, "{}", error.safe_diagnostic());
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(super) enum AnalysisCacheKey {
    File(FileAnalysisKey),
    Database(DatabaseAnalysisKey),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(super) struct FileAnalysisKey {
    pub path: PathBuf,
    pub auxiliary: Option<AuxiliaryFingerprint>,
    pub byte_size: u64,
    pub modified_nanos: u128,
    pub reader: FileReader,
    pub tokenization: TokenizationPolicy,
    pub schema_version: u32,
    pub output_version: u32,
    pub compact_previews: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(super) enum AuxiliaryFingerprint {
    VsCodeTraces([u8; 32]),
    CopilotWorkspace([u8; 32]),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(super) struct DatabaseAnalysisKey {
    pub database: PathBuf,
    pub native_id: String,
    pub revision: [u8; 32],
    pub tokenization: TokenizationPolicy,
    pub schema_version: u32,
    pub output_version: u32,
    pub compact_previews: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct DatabaseFlightKey {
    database: PathBuf,
    native_id: String,
    tokenization: TokenizationPolicy,
    compact_previews: bool,
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
        compact_previews: bool,
    ) -> SharedResult {
        match locator {
            SessionLocator::File(file) => self.response_file(file, config, compact_previews).await,
            SessionLocator::OpenCode {
                database,
                native_id,
            } => {
                let key = DatabaseFlightKey {
                    database,
                    native_id,
                    tokenization: config.tokenization,
                    compact_previews,
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
        let key = AnalysisCacheKey::Database(DatabaseAnalysisKey {
            database: locator.database.clone(),
            native_id: locator.native_id.clone(),
            revision: *snapshot.revision.as_bytes(),
            tokenization: config.tokenization,
            schema_version: crate::analysis::ANALYSIS_SCHEMA_VERSION,
            output_version: crate::analysis::ANALYSIS_OUTPUT_VERSION,
            compact_previews: locator.compact_previews,
        });
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
        let mut analysis =
            source::analyze_reconstructed(replay, config).map_err(FlightError::Analysis)?;
        let body = serialize_analysis(&mut analysis, locator.compact_previews)?;
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

    #[cfg(test)]
    pub async fn response_pi(
        self: &Arc<Self>,
        path: PathBuf,
        config: AnalysisConfig,
    ) -> SharedResult {
        self.response_file(
            FileLocator {
                path,
                reader: FileReader::Pi,
            },
            config,
            false,
        )
        .await
    }

    /// Pi files, Claude Code transcripts and Copilot Chat sessions share the size and
    /// modification time fingerprint; `reader` says which reader the executor uses.
    async fn response_file(
        self: &Arc<Self>,
        locator: FileLocator,
        config: AnalysisConfig,
        compact_previews: bool,
    ) -> SharedResult {
        let preflight_locator = locator;
        let key_result = tokio::task::spawn_blocking(move || {
            let mut key =
                file_cache_key(&preflight_locator.path, preflight_locator.reader, config)?;
            key.compact_previews = compact_previews;
            Ok((preflight_locator, key))
        })
        .await
        .map_err(FlightError::Task)
        .and_then(|result| result);
        let (locator, file_key) = match key_result {
            Ok(key) => key,
            Err(error) => {
                self.report_failure(&error);
                return Err(Arc::new(error));
            }
        };
        let key = AnalysisCacheKey::File(file_key.clone());
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
            self.start(file_key, locator, config, Arc::clone(&flight));
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
        file_key: FileAnalysisKey,
        locator: FileLocator,
        config: AnalysisConfig,
        flight: Arc<AnalysisFlight>,
    ) {
        let key = AnalysisCacheKey::File(file_key.clone());
        let service = Arc::clone(self);
        // Independent supervision survives initiating-request cancellation.
        tokio::spawn(async move {
            let result = match Arc::clone(&service.permits).acquire_owned().await {
                Ok(permit) => {
                    let executor = Arc::clone(&service.executor);
                    let response_key = file_key;
                    match tokio::task::spawn_blocking(move || {
                        let _permit = permit; // Held by actual blocking work, including unwind.
                        executor(locator, config, response_key)
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
pub(super) fn pi_analysis_cache_key(
    path: &Path,
    config: AnalysisConfig,
) -> Result<FileAnalysisKey, FlightError> {
    file_cache_key(path, FileReader::Pi, config)
}

/// Size/mtime identity deliberately preserves the existing cache contract; it
/// cannot detect a rewrite that preserves both values. Never call on async workers.
pub(super) fn file_cache_key(
    path: &Path,
    reader: FileReader,
    config: AnalysisConfig,
) -> Result<FileAnalysisKey, FlightError> {
    let metadata = fs::metadata(path).map_err(FlightError::Io)?;
    let modified_nanos = metadata
        .modified()
        .map_err(FlightError::Io)?
        .duration_since(UNIX_EPOCH)
        .map_err(FlightError::Fingerprint)?
        .as_nanos();
    let canonical_path = fs::canonicalize(path).map_err(FlightError::Io)?;
    // A Copilot session's analysis also reads its trace database.
    let auxiliary = match reader {
        FileReader::VsCodeCopilot => crate::vscode_copilot::traces::database_for(&canonical_path)
            .map(|database| {
                AuxiliaryFingerprint::VsCodeTraces(crate::vscode_copilot::traces::fingerprint(
                    &database,
                ))
            }),
        // A Copilot session's title comes from the `workspace.yaml` beside it.
        FileReader::Copilot => Some(AuxiliaryFingerprint::CopilotWorkspace(
            crate::copilot::discovery::workspace_fingerprint(&canonical_path),
        )),
        _ => None,
    };
    Ok(FileAnalysisKey {
        path: canonical_path,
        auxiliary,
        byte_size: metadata.len(),
        modified_nanos,
        reader,
        tokenization: config.tokenization,
        schema_version: crate::analysis::ANALYSIS_SCHEMA_VERSION,
        output_version: crate::analysis::ANALYSIS_OUTPUT_VERSION,
        compact_previews: false,
    })
}

pub(super) fn execute_analysis(
    locator: FileLocator,
    config: AnalysisConfig,
    response_key: FileAnalysisKey,
) -> Result<Arc<CachedResponse>, FlightError> {
    let source_bytes = response_key.byte_size;
    let started = Instant::now();
    let path = &locator.path;
    let loaded = match source::load_file(&locator) {
        Ok(value) => value,
        Err(error) => {
            return Err(classify_parse_failure(
                path,
                &response_key,
                FlightError::from(error),
            ))
        }
    };
    let parse_ms = started.elapsed().as_secs_f64() * 1000.0;
    let started = Instant::now();
    let mut analysis = analyze(loaded.normalized, config).map_err(FlightError::Analysis)?;
    source::add_reconstruction(&mut analysis, loaded.limitations);
    let analysis_ms = started.elapsed().as_secs_f64() * 1000.0;
    let started = Instant::now();
    let body = serialize_analysis(&mut analysis, response_key.compact_previews)?;
    if !fingerprint_matches(path, &response_key)? {
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
        etag: etag_for_key(&AnalysisCacheKey::File(response_key)),
    }))
}

fn serialize_analysis(
    analysis: &mut crate::api::Analysis,
    compact_previews: bool,
) -> Result<Vec<u8>, FlightError> {
    if compact_previews {
        for preview in analysis
            .context_items
            .iter_mut()
            .filter_map(|item| item.preview.as_mut())
        {
            preview.expanded_text.clear();
        }
    }
    serde_json::to_vec(analysis).map_err(FlightError::Serialization)
}

pub(super) fn classify_parse_failure(
    path: &Path,
    key: &FileAnalysisKey,
    parse_failure: FlightError,
) -> FlightError {
    match fingerprint_matches(path, key) {
        Ok(true) => parse_failure,
        Ok(false) => FlightError::SourceChanged,
        Err(error) => error,
    }
}
fn fingerprint_matches(path: &Path, key: &FileAnalysisKey) -> Result<bool, FlightError> {
    let metadata = fs::metadata(path).map_err(FlightError::Io)?;
    let modified_nanos = metadata
        .modified()
        .map_err(FlightError::Io)?
        .duration_since(UNIX_EPOCH)
        .map_err(FlightError::Fingerprint)?
        .as_nanos();
    Ok(metadata.len() == key.byte_size && modified_nanos == key.modified_nanos)
}
/// Local opaque validator: native path bytes are not a portable storage format.
pub(super) fn etag_for_key(key: &AnalysisCacheKey) -> String {
    fn bytes(hasher: &mut blake3::Hasher, value: &[u8]) {
        hasher.update(&(value.len() as u64).to_le_bytes());
        hasher.update(value);
    }
    let mut hasher = blake3::Hasher::new();
    let (tokenization, schema, output, compact) = match key {
        AnalysisCacheKey::File(key) => {
            hasher.update(b"file");
            bytes(&mut hasher, key.path.as_os_str().as_encoded_bytes());
            hasher.update(&[match key.reader {
                FileReader::Pi => 0,
                FileReader::ClaudeCode(FileKind::Main) => 1,
                FileReader::ClaudeCode(FileKind::Subagent) => 2,
                FileReader::VsCodeCopilot => 3,
                FileReader::Codex => 4,
                FileReader::Copilot => 5,
            }]);
            hasher.update(&key.byte_size.to_le_bytes());
            hasher.update(&key.modified_nanos.to_le_bytes());
            match &key.auxiliary {
                None => {
                    hasher.update(&[0]);
                }
                Some(AuxiliaryFingerprint::VsCodeTraces(hash)) => {
                    hasher.update(&[1]);
                    hasher.update(hash);
                }
                Some(AuxiliaryFingerprint::CopilotWorkspace(hash)) => {
                    hasher.update(&[2]);
                    hasher.update(hash);
                }
            }
            (
                key.tokenization,
                key.schema_version,
                key.output_version,
                key.compact_previews,
            )
        }
        AnalysisCacheKey::Database(key) => {
            hasher.update(b"database");
            bytes(&mut hasher, key.database.as_os_str().as_encoded_bytes());
            bytes(&mut hasher, key.native_id.as_bytes());
            hasher.update(&key.revision);
            (
                key.tokenization,
                key.schema_version,
                key.output_version,
                key.compact_previews,
            )
        }
    };
    bytes(&mut hasher, tokenization.as_str().as_bytes());
    hasher.update(&schema.to_le_bytes());
    hasher.update(&output.to_le_bytes());
    hasher.update(&[u8::from(compact)]);
    format!("\"{}\"", hasher.finalize().to_hex())
}
