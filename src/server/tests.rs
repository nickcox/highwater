use super::*;
use crate::{analysis::analyze, api::Analysis, domain::SourceError, pi::PiSourceAdapter};
use futures_util::StreamExt;
use std::{
    fs as std_fs,
    sync::{
        atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
        Condvar, Mutex,
    },
    time::Duration,
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
        byte_size: Some(1),
        modified_at: None,
        harness: "pi".into(),
        parent_reference: None,
        subagent_type: None,
        locator: None,
        source_revision: None,
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
    let (controls, _control_receiver) = mpsc::channel(1);
    AppState {
        catalog,
        live_state,
        shutdown,
        coordinator: Arc::new(ScanCoordinator { controls }),
        config,
        analysis: Arc::new(AnalysisService::with_state(
            analysis_cache,
            analysis_executor,
        )),
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

struct ScanHarness {
    catalog: Arc<SessionCatalog>,
    shutdown: watch::Sender<bool>,
    controls: mpsc::Sender<ScanControl>,
    hints: mpsc::Sender<watcher::WatchHint>,
    signals: Arc<watcher::WatchSignals>,
    diagnostics: Arc<Diagnostics>,
    worker: JoinHandle<()>,
}

fn scan_harness(scanner: Arc<ScanOperation>) -> ScanHarness {
    let generation = "0123456789abcdef0123456789abcdef".to_owned();
    let catalog = Arc::new(SessionCatalog::new(generation.clone(), Vec::new()));
    let (live_state, _live_receiver) = watch::channel(LiveState {
        generation,
        revision: 0,
        availability: LiveAvailability::Active,
    });
    let (shutdown, shutdown_receiver) = watch::channel(false);
    let signals = Arc::new(watcher::WatchSignals::default());
    let (hints, hint_receiver) = mpsc::channel(32);
    let (controls, control_receiver) = mpsc::channel(32);
    let diagnostics = Arc::new(Diagnostics::default());
    let worker = tokio::spawn(scan_worker(
        ScanWorkerContext {
            root: PathBuf::from("."),
            catalog: Arc::clone(&catalog),
            live_state: live_state.clone(),
            signals: Arc::clone(&signals),
            diagnostics: Arc::clone(&diagnostics),
            shutdown: shutdown_receiver,
            scanner,
        },
        hint_receiver,
        control_receiver,
    ));
    ScanHarness {
        catalog,
        shutdown,
        controls,
        hints,
        signals,
        diagnostics,
        worker,
    }
}

async fn wait_for_invocations(counter: &AtomicUsize, expected: usize) {
    tokio::time::timeout(Duration::from_secs(5), async {
        while counter.load(Ordering::SeqCst) < expected {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap_or_else(|_| panic!("executor did not reach {expected} invocations"));
}

async fn wait_for_counter(counter: &AtomicU64, expected: u64) {
    tokio::time::timeout(Duration::from_secs(3), async {
        while counter.load(Ordering::Acquire) < expected {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap_or_else(|_| panic!("counter did not reach {expected}"));
}

async fn stop_scan_harness(mut harness: ScanHarness) {
    harness.shutdown.send_replace(true);
    tokio::time::timeout(Duration::from_secs(3), &mut harness.worker)
        .await
        .expect("scan worker shutdown")
        .expect("scan worker task");
}

async fn next_sse_event(stream: &mut axum::body::BodyDataStream) -> String {
    let data = tokio::time::timeout(Duration::from_secs(5), stream.next())
        .await
        .expect("SSE event readiness")
        .expect("SSE stream event")
        .expect("SSE body event");
    String::from_utf8(data.to_vec()).expect("SSE UTF-8")
}

async fn wait_for_flight_receivers(state: &AppState, expected: usize) {
    tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            let receivers = state
                .analysis
                .state
                .lock()
                .expect("analysis state")
                .flights
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

#[test]
fn filesystem_hints_set_a_bounded_debounce_window() {
    let start = Instant::now();
    let mut scheduler = ScanScheduler::new(true);
    scheduler.hint(start);
    assert_eq!(
        scheduler.next_deadline(),
        Some(start + scan::DEBOUNCE_QUIET)
    );
    scheduler.hint(start + Duration::from_millis(100));
    assert_eq!(
        scheduler.next_deadline(),
        Some(start + Duration::from_millis(300))
    );
    scheduler.timer(start + Duration::from_millis(300));
    assert!(scheduler.try_start(start + Duration::from_millis(300), false));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn scan_worker_coalesces_active_hints_and_overflow_into_one_follow_up() {
    let invocations = Arc::new(AtomicU64::new(0));
    let first_scan = Arc::new(AtomicBool::new(true));
    let (gate, _guard) = blocking_gate();
    let scanner: Arc<ScanOperation> = {
        let invocations = Arc::clone(&invocations);
        let first_scan = Arc::clone(&first_scan);
        let gate = Arc::clone(&gate);
        Arc::new(move |_, _| {
            invocations.fetch_add(1, Ordering::Release);
            if first_scan.swap(false, Ordering::AcqRel) {
                gate.wait();
            }
            Ok(vec![fixture_session("test.jsonl", "test.jsonl")])
        })
    };
    let harness = scan_harness(scanner);
    let (waiter, response) = oneshot::channel();
    harness
        .controls
        .send(ScanControl::EnsureFresh(waiter))
        .await
        .expect("scan worker control");
    wait_for_counter(&invocations, 1).await;

    for _ in 0..3 {
        harness
            .hints
            .send(watcher::WatchHint::Filesystem)
            .await
            .expect("filesystem hint");
    }
    harness.signals.overflow.store(true, Ordering::Release);
    harness.signals.wake.notify_one();
    gate.release();

    assert!(matches!(response.await.expect("refresh waiter"), Ok(())));
    wait_for_counter(&invocations, 2).await;
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert_eq!(invocations.load(Ordering::Acquire), 2);
    stop_scan_harness(harness).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn scan_worker_retries_catalogue_install_failures_and_wakes_waiters() {
    let scanner: Arc<ScanOperation> = Arc::new(|_, _| Ok(Vec::new()));
    let harness = scan_harness(scanner);
    let poisoned = Arc::clone(&harness.catalog);
    let panic_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _guard = poisoned.snapshot.write().expect("catalogue lock");
        panic!("poison catalogue for install failure test");
    }));
    assert!(panic_result.is_err());

    let (waiter, response) = oneshot::channel();
    harness
        .controls
        .send(ScanControl::EnsureFresh(waiter))
        .await
        .expect("scan worker control");
    let result = tokio::time::timeout(Duration::from_secs(3), response)
        .await
        .expect("install failure waiter timeout")
        .expect("install failure waiter channel");
    assert!(result.is_err());
    assert_eq!(
        harness
            .diagnostics
            .catalogue_refresh_failures
            .load(Ordering::Acquire),
        scan::RETRY_DELAYS.len() as u64 + 1
    );
    assert_eq!(
        harness
            .diagnostics
            .catalogue_refresh_retries
            .load(Ordering::Acquire),
        scan::RETRY_DELAYS.len() as u64
    );
    stop_scan_harness(harness).await;
}

#[tokio::test]
async fn shutdown_drain_timeout_is_reported_without_claiming_completion() {
    let diagnostics = Diagnostics::default();
    let mut active = Some(tokio::spawn(async {
        std::future::pending::<Result<Vec<SessionFile>, ScanError>>().await
    }));
    drain_active_scan_with_timeout(&mut active, &diagnostics, Duration::ZERO).await;
    assert_eq!(
        diagnostics
            .scan_shutdown_drain_timeouts
            .load(Ordering::Acquire),
        1
    );
    drop(active);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn scan_worker_shutdown_race_does_not_install_completed_scan() {
    let first_scan = Arc::new(AtomicBool::new(true));
    let (gate, _guard) = blocking_gate();
    let scanner: Arc<ScanOperation> = {
        let first_scan = Arc::clone(&first_scan);
        let gate = Arc::clone(&gate);
        Arc::new(move |_, _| {
            if first_scan.swap(false, Ordering::AcqRel) {
                gate.wait();
            }
            Ok(vec![fixture_session("race.jsonl", "race.jsonl")])
        })
    };
    let mut harness = scan_harness(scanner);
    let (waiter, response) = oneshot::channel();
    harness
        .controls
        .send(ScanControl::EnsureFresh(waiter))
        .await
        .expect("scan worker control");
    wait_for_counter(&harness.diagnostics.watch_refreshes_started, 1).await;

    harness.shutdown.send_replace(true);
    gate.release();
    tokio::time::timeout(Duration::from_secs(3), &mut harness.worker)
        .await
        .expect("scan worker shutdown")
        .expect("scan worker task");
    assert!(response.await.expect("shutdown waiter").is_err());
    assert_eq!(
        harness
            .catalog
            .snapshot()
            .expect("catalogue snapshot")
            .revision,
        0
    );
}

fn failing_watcher(
    _: &FsPath,
    _: mpsc::Sender<watcher::WatchHint>,
    _: Arc<watcher::WatchSignals>,
) -> notify::Result<watcher::WatcherHandle> {
    Err(notify::Error::generic("controlled watcher startup failure"))
}

#[tokio::test]
async fn injected_watcher_failure_keeps_degraded_http_usable() {
    let signals = Arc::new(watcher::WatchSignals::default());
    let (hints, _receiver) = mpsc::channel(1);
    assert!(
        start_watcher_or_degraded(FsPath::new("."), hints, &signals, failing_watcher,).is_none()
    );
    assert!(signals.watcher_failed.load(Ordering::Acquire));

    let mut state = test_state(
        fixture_session("fixtures/pi/simple.jsonl", "simple.jsonl"),
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
        },
        Arc::new(Mutex::new(AnalysisCache::default())),
    );
    let generation = state.live_state.borrow().generation.clone();
    state.live_state.send_replace(LiveState {
        generation,
        revision: 0,
        availability: LiveAvailability::Degraded,
    });
    let (controls, mut requests) = mpsc::channel(1);
    state.coordinator = Arc::new(ScanCoordinator { controls });
    let responder = tokio::spawn(async move {
        if let Some(ScanControl::EnsureFresh(waiter)) = requests.recv().await {
            let _ = waiter.send(Ok(()));
        }
    });

    let response = router(state)
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/sessions")
                .body(axum::body::Body::empty())
                .expect("request"),
        )
        .await
        .expect("degraded sessions response");
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()["X-Highwater-Live-Updates"], "degraded");
    responder.await.expect("degraded responder");
}

#[tokio::test]
async fn sse_stream_emits_payloads_updates_converges_for_lagged_subscribers_and_stops() {
    let state = test_state(
        fixture_session("fixtures/pi/simple.jsonl", "simple.jsonl"),
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
        },
        Arc::new(Mutex::new(AnalysisCache::default())),
    );
    let live_state = state.live_state.clone();
    let shutdown = state.shutdown.clone();
    let app = router(state);
    let event_request = || {
        axum::http::Request::builder()
            .uri("/api/events")
            .body(axum::body::Body::empty())
            .expect("event request")
    };

    let first_response = app
        .clone()
        .oneshot(event_request())
        .await
        .expect("first SSE response");
    assert_eq!(first_response.status(), StatusCode::OK);
    assert_eq!(
        first_response.headers()[header::CONTENT_TYPE],
        "text/event-stream"
    );
    let mut first = first_response.into_body().into_data_stream();
    let first_catalogue = next_sse_event(&mut first).await;
    let first_status = next_sse_event(&mut first).await;
    assert!(first_catalogue.contains("event: sessionsChanged"));
    assert!(first_catalogue.contains("id: 0123456789abcdef0123456789abcdef:0"));
    assert!(first_catalogue.contains("\"revision\":\"0\""));
    assert!(first_status.contains("event: liveStatus"));
    assert!(first_status.contains("\"availability\":\"active\""));

    let second_response = app
        .oneshot(event_request())
        .await
        .expect("second SSE response");
    let mut second = second_response.into_body().into_data_stream();
    assert!(next_sse_event(&mut second)
        .await
        .contains("\"revision\":\"0\""));
    assert!(next_sse_event(&mut second)
        .await
        .contains("event: liveStatus"));

    live_state.send_replace(LiveState {
        generation: "0123456789abcdef0123456789abcdef".into(),
        revision: 1,
        availability: LiveAvailability::Active,
    });
    assert!(next_sse_event(&mut first)
        .await
        .contains("\"revision\":\"1\""));
    assert!(next_sse_event(&mut second)
        .await
        .contains("\"revision\":\"1\""));

    for revision in 2..=3 {
        live_state.send_replace(LiveState {
            generation: "0123456789abcdef0123456789abcdef".into(),
            revision,
            availability: if revision == 3 {
                LiveAvailability::Degraded
            } else {
                LiveAvailability::Active
            },
        });
    }
    let first_lagged = next_sse_event(&mut first).await;
    let second_lagged = next_sse_event(&mut second).await;
    assert!(first_lagged.contains("\"revision\":\"3\""));
    assert!(second_lagged.contains("\"revision\":\"3\""));
    assert!(next_sse_event(&mut first)
        .await
        .contains("\"availability\":\"degraded\""));
    assert!(next_sse_event(&mut second)
        .await
        .contains("\"availability\":\"degraded\""));

    shutdown.send_replace(true);
    assert!(tokio::time::timeout(Duration::from_secs(1), first.next())
        .await
        .expect("first SSE shutdown")
        .is_none());
    assert!(tokio::time::timeout(Duration::from_secs(1), second.next())
        .await
        .expect("second SSE shutdown")
        .is_none());
}

#[tokio::test]
async fn internal_errors_use_server_status_and_redacted_messages() {
    let response = AppError::Message("private /tmp/session.jsonl detail".into()).into_response();
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    let body = response_body(response).await;
    let body = String::from_utf8(body).expect("UTF-8 error response");
    assert!(body.contains("SESSION_ANALYSIS_FAILED"));
    assert!(!body.contains("/tmp/session.jsonl"));

    let response = AppError::Io(std::io::Error::new(
        std::io::ErrorKind::NotFound,
        "/tmp/missing.jsonl",
    ))
    .into_response();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert!(String::from_utf8(response_body(response).await)
        .expect("UTF-8 error response")
        .contains("SESSION_NOT_FOUND"));
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
    assert_eq!(response.headers()["X-Highwater-Catalog-Revision"], "0");
    assert_eq!(response.headers()["X-Highwater-Live-Updates"], "active");
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
        .contains_key("X-Highwater-Server-Generation"));
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
    wait_for_invocations(&invocations, 1).await;
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
                Err(FlightError::Source(SourceError::InvalidStructure(
                    "controlled parse failure".into(),
                )))
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
    wait_for_invocations(&invocations, 1).await;
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
    assert!(state
        .analysis
        .state
        .lock()
        .expect("analysis state")
        .flights
        .is_empty());

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
    wait_for_invocations(&invocations, 1).await;
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
async fn analysis_execution_is_bounded_across_distinct_keys() {
    let invocations = Arc::new(AtomicUsize::new(0));
    let active = Arc::new(AtomicUsize::new(0));
    let maximum = Arc::new(AtomicUsize::new(0));
    let (gate, release) = blocking_gate();
    let executor: Arc<AnalysisExecutor> = {
        let invocations = Arc::clone(&invocations);
        let active = Arc::clone(&active);
        let maximum = Arc::clone(&maximum);
        let gate = Arc::clone(&gate);
        Arc::new(move |_, _, _| {
            let running = active.fetch_add(1, Ordering::SeqCst) + 1;
            maximum.fetch_max(running, Ordering::SeqCst);
            invocations.fetch_add(1, Ordering::SeqCst);
            gate.wait();
            let response = sized_response(10);
            active.fetch_sub(1, Ordering::SeqCst);
            Ok(response)
        })
    };
    let mut second = fixture_session("fixtures/pi/compaction.jsonl", "second.jsonl");
    second.id = "second".into();
    let mut third = fixture_session("fixtures/pi/branch.jsonl", "third.jsonl");
    third.id = "third".into();
    let state = test_state_with_executor(
        vec![
            fixture_session("fixtures/pi/simple.jsonl", "simple.jsonl"),
            second,
            third,
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
    let second = tokio::spawn(app.clone().oneshot(request("second")));
    let third = tokio::spawn(app.oneshot(request("third")));
    wait_for_invocations(&invocations, ANALYSIS_CONCURRENCY_LIMIT).await;
    tokio::task::yield_now().await;
    assert_eq!(
        invocations.load(Ordering::SeqCst),
        ANALYSIS_CONCURRENCY_LIMIT
    );
    release.0.release();
    for task in [first, second, third] {
        assert_eq!(
            task.await
                .expect("request task")
                .expect("response")
                .status(),
            StatusCode::OK
        );
    }
    assert_eq!(invocations.load(Ordering::SeqCst), 3);
    assert_eq!(active.load(Ordering::SeqCst), 0);
    assert_eq!(maximum.load(Ordering::SeqCst), ANALYSIS_CONCURRENCY_LIMIT);
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
    let mut second_session = fixture_session("fixtures/pi/compaction.jsonl", "compaction.jsonl");
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
    wait_for_invocations(&invocations, 2).await;
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

fn rewrite_with_changed_mtime(path: &FsPath, bytes: &[u8]) {
    let modified = std_fs::metadata(path)
        .expect("metadata")
        .modified()
        .expect("mtime")
        .checked_add(Duration::from_secs(2))
        .expect("mtime increment");
    std_fs::write(path, bytes).expect("rewrite");
    std_fs::File::options()
        .write(true)
        .open(path)
        .expect("file")
        .set_times(std_fs::FileTimes::new().set_modified(modified))
        .expect("deterministic changed mtime");
}

#[tokio::test]
async fn request_cache_invalidates_after_same_size_file_rewrite() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let path = directory.path().join("session.jsonl");
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
    rewrite_with_changed_mtime(&path, contents.replace("hello", "world").as_bytes());
    let second = app
        .oneshot(request("session.jsonl"))
        .await
        .expect("second response");
    let second_body = response_body(second).await;
    assert_ne!(first_body, second_body);
    assert_eq!(cache.lock().expect("cache").entries.len(), 2);
}

#[test]
fn cache_key_tracks_filesystem_fingerprint_and_configuration() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let path = directory.path().join("session.jsonl");
    std_fs::write(&path, b"abc").expect("initial file");
    let auto = AnalysisConfig {
        tokenization: TokenizationPolicy::Auto,
        perf_diagnostics: false,
    };
    let first = analysis_cache_key(&path, auto).expect("first fingerprint");
    rewrite_with_changed_mtime(&path, b"xyz");
    let second = analysis_cache_key(&path, auto).expect("rewritten fingerprint");
    assert_eq!(first.byte_size, second.byte_size);
    assert_ne!(first.modified_nanos, second.modified_nanos);

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
}

#[test]
fn analysis_rejects_a_source_changed_after_the_initial_fingerprint() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let path = directory.path().join("session.jsonl");
    std_fs::copy("fixtures/pi/simple.jsonl", &path).expect("copy fixture");
    let config = AnalysisConfig {
        tokenization: TokenizationPolicy::Heuristic,
        perf_diagnostics: false,
    };
    let key = analysis_cache_key(&path, config).expect("initial fingerprint");
    let original = std_fs::read_to_string(&path).expect("read fixture copy");
    let changed = original.replace("hello", "world");
    rewrite_with_changed_mtime(&path, changed.as_bytes());
    let result = execute_analysis(path.clone(), config, key);
    assert!(matches!(result, Err(FlightError::SourceChanged)));
}

#[test]
fn vanished_source_during_parse_failure_is_not_reported_as_bad_format() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let path = directory.path().join("never-created.jsonl");
    let key = AnalysisCacheKey {
        path: path.clone(),
        database_revision: None,
        byte_size: 1,
        modified_nanos: 1,
        reader: super::analysis::FileReader::Pi,
        tokenization: TokenizationPolicy::Auto,
        schema_version: crate::analysis::ANALYSIS_SCHEMA_VERSION,
        output_version: crate::analysis::ANALYSIS_OUTPUT_VERSION,
    };
    let result = classify_parse_failure(
        &path,
        &key,
        FlightError::Source(SourceError::InvalidStructure("invalid transcript".into())),
    );
    assert!(matches!(
        result,
        FlightError::Io(ref source) if source.kind() == std::io::ErrorKind::NotFound
    ));
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
        database_revision: None,
        byte_size,
        modified_nanos: 0,
        reader: super::analysis::FileReader::Pi,
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
        database_revision: None,
        byte_size,
        modified_nanos: 0,
        reader: super::analysis::FileReader::Pi,
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
