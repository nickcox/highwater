mod analysis;
mod assets;
mod catalog;
#[cfg(test)]
mod claude_code_tests;
mod error;
mod events;
mod local_origin;
#[cfg(test)]
mod opencode_tests;
mod routes;
mod scan;
mod sources;
use routes::router;
mod watcher;

use crate::analysis::{AnalysisConfig, TokenizationPolicy};
#[cfg(test)]
use analysis::{
    analysis_cache_key, classify_parse_failure, etag_for_key, AnalysisCache, AnalysisCacheKey,
    AnalysisExecutor, AnalysisFlight, CachedResponse,
};
use analysis::{execute_analysis, AnalysisService};
#[cfg(test)]
use axum::{
    http::{header, StatusCode},
    response::IntoResponse,
};
use catalog::{ScanError, SessionCatalog};
use chrono::{DateTime, Utc};
use clap::{Parser, ValueEnum};
use error::AppError;
#[cfg(test)]
use error::FlightError;
use events::{LiveAvailability, LiveState};
use scan::{FailureDisposition, ScanScheduler};
use serde::Serialize;
use std::{
    net::SocketAddr,
    path::{Path as FsPath, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
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
    /// OpenCode SQLite database (repeatable). Explicit Pi roots remain Pi-only unless set.
    #[arg(long)]
    pub opencode_db: Vec<PathBuf>,
    /// Claude Code projects directory (repeatable). Replaces the default
    /// `$CLAUDE_CONFIG_DIR/projects` or `~/.claude/projects`.
    #[arg(long)]
    pub claude_root: Vec<PathBuf>,
    #[arg(long, default_value_t = 43123)]
    pub port: u16,
    #[arg(long, value_enum, default_value_t = TokenizationArg::Auto)]
    pub tokenization: TokenizationArg,
    #[arg(long)]
    pub perf_diagnostics: bool,
}

type ScanOperation =
    dyn Fn(PathBuf, Arc<AtomicBool>) -> Result<Vec<SessionFile>, ScanError> + Send + Sync;

#[derive(Clone)]
pub(crate) struct AppState {
    catalog: Arc<SessionCatalog>,
    live_state: watch::Sender<LiveState>,
    shutdown: watch::Sender<bool>,
    coordinator: Arc<ScanCoordinator>,
    config: AnalysisConfig,
    analysis: Arc<AnalysisService>,
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
    scan_shutdown_drain_timeouts: AtomicU64,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionFile {
    id: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    path: String,
    file_name: String,
    display_name: String,
    working_directory: Option<String>,
    started_at: Option<DateTime<Utc>>,
    byte_size: Option<u64>,
    modified_at: Option<DateTime<Utc>>,
    harness: String,
    parent_reference: Option<String>,
    /// A Claude Code subagent's type, from its metadata file. Omitted otherwise.
    #[serde(skip_serializing_if = "Option::is_none")]
    subagent_type: Option<String>,
    #[serde(skip)]
    locator: Option<crate::source::SessionLocator>,
    #[serde(skip)]
    source_revision: Option<u64>,
    #[serde(skip)]
    modified_nanos: Option<u128>,
}

const HINT_CHANNEL_CAPACITY: usize = 256;
const DEGRADED_SCAN_DEADLINE: Duration = Duration::from_secs(5);
const SCAN_SHUTDOWN_DRAIN: Duration = Duration::from_secs(2);
const ANALYSIS_CONCURRENCY_LIMIT: usize = 2;

type WatcherStarter = fn(
    &FsPath,
    mpsc::Sender<watcher::WatchHint>,
    Arc<watcher::WatchSignals>,
) -> notify::Result<watcher::WatcherHandle>;

pub(crate) async fn run(args: Args) -> Result<(), Box<dyn std::error::Error>> {
    run_with_watcher(args, watcher::start).await
}

fn start_watcher_or_degraded(
    root: &FsPath,
    hint_sender: mpsc::Sender<watcher::WatchHint>,
    signals: &Arc<watcher::WatchSignals>,
    start_watcher: WatcherStarter,
) -> Option<watcher::WatcherHandle> {
    match start_watcher(root, hint_sender, Arc::clone(signals)) {
        Ok(watcher) => Some(watcher),
        Err(_) => {
            // A readable root still has useful request-driven discovery even
            // when the platform watcher cannot be installed.
            eprintln!("filesystem watcher unavailable; live discovery is degraded");
            signals.watcher_failed.store(true, Ordering::Release);
            None
        }
    }
}

async fn run_with_watcher(
    args: Args,
    start_watcher: WatcherStarter,
) -> Result<(), Box<dyn std::error::Error>> {
    let home = PathBuf::from(std::env::var_os("HOME").unwrap_or_default());
    let data_home = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .filter(|path| path.is_absolute())
        .unwrap_or_else(|| home.join(".local/share"));
    let claude_config_dir = std::env::var_os("CLAUDE_CONFIG_DIR")
        .map(PathBuf::from)
        .filter(|path| path.is_absolute());
    let sources = tokio::task::spawn_blocking(move || {
        sources::SourceSet::configured(
            args.session_root,
            args.opencode_db,
            args.claude_root,
            &home,
            &data_home,
            claude_config_dir.as_deref(),
        )
    })
    .await??;
    let root = sources.pi_root.clone().unwrap_or_default();
    let generation = new_generation()?;
    let diagnostics = Arc::new(Diagnostics::default());
    let signals = Arc::new(watcher::WatchSignals::default());
    let (hint_sender, hint_receiver) = mpsc::channel(HINT_CHANNEL_CAPACITY);
    let mut watchers = Vec::new();
    if let Some(pi_root) = &sources.pi_root {
        if let Some(watcher) =
            start_watcher_or_degraded(pi_root, hint_sender.clone(), &signals, start_watcher)
        {
            watchers.push(watcher);
        }
    }
    for claude_root in &sources.claude_roots {
        if let Some(watcher) =
            start_watcher_or_degraded(claude_root, hint_sender.clone(), &signals, start_watcher)
        {
            watchers.push(watcher);
        }
    }
    for database in &sources.databases {
        match watcher::start_database(database, hint_sender.clone(), Arc::clone(&signals)) {
            Ok(watcher) => watchers.push(watcher),
            Err(_) => {
                signals.watcher_failed.store(true, Ordering::Release);
            }
        }
    }
    let scanner = Arc::new(sources::MixedScanner::new(&sources, Arc::clone(&signals)));
    let initial_scanner = Arc::clone(&scanner);
    let sessions =
        tokio::task::spawn_blocking(move || initial_scanner.scan(Arc::new(AtomicBool::new(false))))
            .await??;
    diagnostics
        .catalogue_sessions
        .store(sessions.len() as u64, Ordering::Relaxed);
    println!("Discovered {} sessions", sessions.len());

    let catalog = Arc::new(SessionCatalog::new(generation.clone(), sessions));
    let (live_state, _live_receiver) = watch::channel(LiveState {
        generation: generation.clone(),
        revision: 0,
        availability: if !signals.watcher_failed.load(Ordering::Acquire)
            && !signals.sources_degraded.load(Ordering::Acquire)
            && !watchers.is_empty()
        {
            LiveAvailability::Active
        } else {
            LiveAvailability::Degraded
        },
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
    let worker_shutdown = shutdown.subscribe();
    let worker = tokio::spawn(scan_worker(
        ScanWorkerContext {
            root: worker_root,
            catalog: worker_catalog,
            live_state: worker_live_state,
            signals: worker_signals,
            diagnostics: worker_diagnostics,
            shutdown: worker_shutdown,
            scanner: Arc::new(move |_, cancelled| scanner.scan(cancelled)),
        },
        hint_receiver,
        control_receiver,
    ));

    // SQLite data_version polling is an authoritative fallback for missed WAL
    // notifications. It never hashes all message payloads on catalogue refresh.
    let poller = if sources.databases.is_empty() {
        None
    } else {
        let mut stop = shutdown.subscribe();
        Some(tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(2));
            interval.tick().await;
            loop {
                tokio::select! {
                    _ = stop.changed() => break,
                    _ = interval.tick() => {
                        if hint_sender.try_send(watcher::WatchHint::Filesystem).is_err() { signals.overflow.store(true, Ordering::Release); signals.wake.notify_one(); }
                    }
                }
            }
        }))
    };
    let perf_diagnostics = args.perf_diagnostics;
    let state = AppState {
        catalog,
        live_state,
        shutdown: shutdown.clone(),
        coordinator: Arc::clone(&coordinator),
        config: AnalysisConfig {
            tokenization: args.tokenization.into(),
            perf_diagnostics,
        },
        analysis: Arc::new(AnalysisService::new(Arc::new(execute_analysis))),
    };
    let address = SocketAddr::from(([127, 0, 0, 1], args.port));
    let listener = tokio::net::TcpListener::bind(address).await?;
    // Use the bound port so `--port 0` still accepts its own Host header.
    let address = listener.local_addr()?;
    let app = local_origin::protect(router(state), address.port());
    println!("Listening on http://{address}");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(shutdown.clone()))
        .await?;

    coordinator.shutdown().await;
    match tokio::time::timeout(SCAN_SHUTDOWN_DRAIN, worker).await {
        Ok(Ok(())) => {}
        Ok(Err(error)) => eprintln!("catalogue worker failed during shutdown: {error}"),
        Err(_) => eprintln!(
            "catalogue worker shutdown timed out; blocking catalogue work may still be running"
        ),
    }
    if let Some(poller) = poller {
        poller.abort();
    }
    drop(watchers);
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
        "live_updates_perf watch_events_received={} watch_hints_dropped={} watch_refreshes_started={} watch_refreshes_changed={} watch_refreshes_unchanged={} watch_errors={} catalogue_refresh_failures={} catalogue_refresh_retries={} catalogue_degraded_refreshes={} catalogue_sessions={} catalogue_refresh_ms={} scan_shutdown_drain_timeouts={}",
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
        diagnostics
            .scan_shutdown_drain_timeouts
            .load(Ordering::Relaxed),
    );
}

fn new_generation() -> Result<String, AppError> {
    let mut bytes = [0_u8; 16];
    getrandom::fill(&mut bytes).map_err(|error| AppError::Message(error.to_string()))?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
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

fn handle_scan_failure(
    scheduler: &mut ScanScheduler,
    diagnostics: &Diagnostics,
    catalog: &SessionCatalog,
    live_state: &watch::Sender<LiveState>,
    waiters: &mut Vec<oneshot::Sender<Result<(), String>>>,
    message: String,
) {
    diagnostics
        .catalogue_refresh_failures
        .fetch_add(1, Ordering::Relaxed);
    match scheduler.scan_failed(Instant::now()) {
        FailureDisposition::Retry { .. } => {
            diagnostics
                .catalogue_refresh_retries
                .fetch_add(1, Ordering::Relaxed);
        }
        FailureDisposition::Exhausted => {
            diagnostics
                .catalogue_degraded_refreshes
                .fetch_add(1, Ordering::Relaxed);
            publish_live_state(catalog, live_state, LiveAvailability::Degraded);
            for waiter in waiters.drain(..) {
                let _ = waiter.send(Err(message.clone()));
            }
        }
    }
}

async fn drain_active_scan(
    active: &mut Option<JoinHandle<Result<Vec<SessionFile>, ScanError>>>,
    diagnostics: &Diagnostics,
) {
    drain_active_scan_with_timeout(active, diagnostics, SCAN_SHUTDOWN_DRAIN).await;
}

async fn drain_active_scan_with_timeout(
    active: &mut Option<JoinHandle<Result<Vec<SessionFile>, ScanError>>>,
    diagnostics: &Diagnostics,
    timeout_duration: Duration,
) {
    if active.is_none() {
        return;
    }
    match tokio::time::timeout(timeout_duration, wait_for_scan(active)).await {
        Ok(Ok(_)) => {}
        Ok(Err(error)) => {
            eprintln!("catalogue scan failed while draining during shutdown: {error}");
        }
        Err(_) => {
            diagnostics
                .scan_shutdown_drain_timeouts
                .fetch_add(1, Ordering::Relaxed);
            eprintln!(
                "catalogue scan shutdown drain timed out; blocking catalogue work may still be running"
            );
        }
    }
}

struct ScanWorkerContext {
    root: PathBuf,
    catalog: Arc<SessionCatalog>,
    live_state: watch::Sender<LiveState>,
    signals: Arc<watcher::WatchSignals>,
    diagnostics: Arc<Diagnostics>,
    shutdown: watch::Receiver<bool>,
    scanner: Arc<ScanOperation>,
}

async fn scan_worker(
    context: ScanWorkerContext,
    mut hints: mpsc::Receiver<watcher::WatchHint>,
    mut controls: mpsc::Receiver<ScanControl>,
) {
    let ScanWorkerContext {
        root,
        catalog,
        live_state,
        signals,
        diagnostics,
        mut shutdown,
        scanner,
    } = context;
    let cancelled = Arc::new(AtomicBool::new(false));
    let mut active: Option<JoinHandle<Result<Vec<SessionFile>, ScanError>>> = None;
    let mut scheduler = ScanScheduler::new(true);
    let mut waiters: Vec<oneshot::Sender<Result<(), String>>> = Vec::new();

    loop {
        if *shutdown.borrow() {
            scheduler.shutdown();
            cancelled.store(true, Ordering::Release);
            for waiter in waiters.drain(..) {
                let _ = waiter.send(Err("catalogue refresh is shutting down".into()));
            }
            drain_active_scan(&mut active, &diagnostics).await;
            break;
        }
        waiters.retain(|waiter| !waiter.is_closed());
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
            scheduler.hint(Instant::now());
        }
        if signals.overflow.swap(false, Ordering::AcqRel) {
            scheduler.hint(Instant::now());
        }
        if signals.watcher_failed.swap(false, Ordering::AcqRel) {
            diagnostics.watch_errors.fetch_add(1, Ordering::Relaxed);
            if scheduler.watcher_failed() {
                publish_live_state(&catalog, &live_state, LiveAvailability::Degraded);
            }
        }

        if scheduler.try_start(Instant::now(), active.is_some()) {
            diagnostics
                .watch_refreshes_started
                .fetch_add(1, Ordering::Relaxed);
            let scan_root = root.clone();
            let scan_cancelled = Arc::clone(&cancelled);
            let scan_operation = Arc::clone(&scanner);
            active = Some(tokio::spawn(async move {
                match tokio::task::spawn_blocking(move || scan_operation(scan_root, scan_cancelled))
                    .await
                {
                    Ok(result) => result,
                    Err(error) => Err(ScanError::Transient(format!(
                        "catalogue scan task failed: {error}"
                    ))),
                }
            }));
        }

        let next_deadline = scheduler.next_deadline();
        let mut timer = Box::pin(async move {
            match next_deadline {
                Some(deadline) => {
                    tokio::time::sleep_until(tokio::time::Instant::from_std(deadline)).await;
                }
                None => std::future::pending::<()>().await,
            }
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
                let elapsed = scheduler
                    .scan_started_at()
                    .map(|started| started.elapsed().as_millis() as u64)
                    .unwrap_or_default();
                diagnostics.catalogue_refresh_ms.fetch_add(elapsed, Ordering::Relaxed);
                if *shutdown.borrow() {
                    scheduler.shutdown();
                    cancelled.store(true, Ordering::Release);
                    for waiter in waiters.drain(..) {
                        let _ = waiter.send(Err("catalogue refresh is shutting down".into()));
                    }
                    break;
                }
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
                                scheduler.scan_succeeded(changed);
                                if signals.sources_degraded.load(Ordering::Acquire) {
                                    scheduler.sources_failed();
                                }
                                let availability = if scheduler.is_degraded() {
                                    LiveAvailability::Degraded
                                } else {
                                    LiveAvailability::Active
                                };
                                // Source health can recover even when retained
                                // metadata is unchanged. Avoid redundant status
                                // broadcasts for an ongoing partial failure.
                                if changed || live_state.borrow().availability != availability {
                                    publish_live_state(&catalog, &live_state, availability);
                                }
                                for waiter in waiters.drain(..) {
                                    let _ = waiter.send(Ok(()));
                                }
                            }
                            Err(error) => handle_scan_failure(
                                &mut scheduler,
                                &diagnostics,
                                &catalog,
                                &live_state,
                                &mut waiters,
                                error.to_string(),
                            ),
                        }
                    }
                    Err(ScanError::Cancelled) => break,
                    Err(error) => handle_scan_failure(
                        &mut scheduler,
                        &diagnostics,
                        &catalog,
                        &live_state,
                        &mut waiters,
                        error.to_string(),
                    ),
                }
            }
            shutdown_result = shutdown.changed() => {
                if shutdown_result.is_err() || *shutdown.borrow_and_update() {
                    scheduler.shutdown();
                    cancelled.store(true, Ordering::Release);
                    for waiter in waiters.drain(..) {
                        let _ = waiter.send(Err("catalogue refresh is shutting down".into()));
                    }
                    drain_active_scan(&mut active, &diagnostics).await;
                    break;
                }
            }
            control = controls.recv() => {
                match control {
                    Some(ScanControl::EnsureFresh(waiter)) => {
                        waiters.push(waiter);
                        let degraded = scheduler.is_degraded();
                        scheduler.request(Instant::now(), active.is_some());
                        if degraded {
                            diagnostics
                                .catalogue_degraded_refreshes
                                .fetch_add(1, Ordering::Relaxed);
                        }
                    }
                    Some(ScanControl::Shutdown) | None => {
                        scheduler.shutdown();
                        cancelled.store(true, Ordering::Release);
                        for waiter in waiters.drain(..) {
                            let _ = waiter.send(Err("catalogue refresh is shutting down".into()));
                        }
                        drain_active_scan(&mut active, &diagnostics).await;
                        break;
                    }
                }
            }
            Some(hint) = hints.recv() => {
                match hint {
                    watcher::WatchHint::Filesystem => scheduler.hint(Instant::now()),
                }
            }
            _ = signals.wake.notified() => {}
            _ = &mut timer => scheduler.timer(Instant::now()),
        }
    }
}

#[cfg(test)]
mod tests;
