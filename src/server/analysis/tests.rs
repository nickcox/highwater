use super::*;
use crate::domain::SourceError;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Condvar,
};
use std::time::Duration;

fn config() -> AnalysisConfig {
    AnalysisConfig {
        tokenization: TokenizationPolicy::Heuristic,
        perf_diagnostics: false,
    }
}
fn path() -> PathBuf {
    fs::canonicalize("fixtures/pi/simple.jsonl").expect("fixture")
}
fn response(size: usize) -> Arc<CachedResponse> {
    Arc::new(CachedResponse {
        body: bytes::Bytes::from(vec![b'x'; size]),
        etag: "\"test\"".into(),
        approximate_bytes: size,
    })
}
#[derive(Default)]
struct Gate {
    released: Mutex<bool>,
    changed: Condvar,
}
impl Gate {
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
struct Release(Arc<Gate>);
impl Drop for Release {
    fn drop(&mut self) {
        self.0.release();
    }
}
fn gate() -> (Arc<Gate>, Release) {
    let gate = Arc::new(Gate::default());
    (Arc::clone(&gate), Release(gate))
}

async fn subscribers(service: &AnalysisService, expected: usize) {
    tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            let count = service
                .state
                .lock()
                .expect("state")
                .flights
                .values()
                .next()
                .map(|flight| flight.result.receiver_count())
                .unwrap_or(0);
            if count >= expected {
                break;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .expect("flight subscribers");
}
fn request(service: &Arc<AnalysisService>) -> tokio::task::JoinHandle<SharedResult> {
    let service = Arc::clone(service);
    tokio::spawn(async move { service.response(path(), config()).await })
}

#[tokio::test]
async fn warm_cache_succeeds_with_all_execution_permits_occupied() {
    let calls = Arc::new(AtomicUsize::new(0));
    let count = Arc::clone(&calls);
    let service = Arc::new(AnalysisService::new(Arc::new(move |_, _, _| {
        count.fetch_add(1, Ordering::SeqCst);
        Ok(response(4))
    })));
    let first = service
        .response(path(), config())
        .await
        .expect("cold response");
    let _held = Arc::clone(&service.permits)
        .acquire_many_owned(2)
        .await
        .expect("all permits");
    let warm = tokio::time::timeout(Duration::from_secs(1), service.response(path(), config()))
        .await
        .expect("warm cache does not wait for permit")
        .expect("warm response");
    assert!(Arc::ptr_eq(&first, &warm));
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn queued_same_key_requests_coalesce_and_initiator_cancellation_is_independent() {
    let calls = Arc::new(AtomicUsize::new(0));
    let count = Arc::clone(&calls);
    let service = Arc::new(AnalysisService::new(Arc::new(move |_, _, _| {
        count.fetch_add(1, Ordering::SeqCst);
        Ok(response(4))
    })));
    let held = Arc::clone(&service.permits)
        .acquire_many_owned(2)
        .await
        .expect("all permits");
    let first = request(&service);
    subscribers(&service, 1).await;
    let second = request(&service);
    subscribers(&service, 2).await;
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    assert_eq!(service.state.lock().expect("state").flights.len(), 1);
    first.abort();
    first.await.expect_err("cancel initiator");
    drop(held);
    second.await.expect("waiter task").expect("waiter response");
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert!(service.state.lock().expect("state").flights.is_empty());
    assert_eq!(service.state.lock().expect("state").entries.len(), 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn typed_errors_and_panics_fan_out_once_and_allow_stable_retry() {
    for panic in [false, true] {
        let calls = Arc::new(AtomicUsize::new(0));
        let (gate, _release) = gate();
        let count = Arc::clone(&calls);
        let operation_gate = Arc::clone(&gate);
        let diagnostics = Arc::new(Mutex::new(Vec::new()));
        let recorded = Arc::clone(&diagnostics);
        let reported = Arc::new(tokio::sync::Notify::new());
        let report_signal = Arc::clone(&reported);
        let service = Arc::new(
            AnalysisService::new(Arc::new(move |_, _, _| {
                if count.fetch_add(1, Ordering::SeqCst) == 0 {
                    operation_gate.wait();
                    if panic {
                        panic!("controlled executor panic");
                    }
                    return Err(FlightError::Source(SourceError::InvalidStructure(
                        "private /tmp/transcript contents".into(),
                    )));
                }
                Ok(response(4))
            }))
            .with_reporter(Arc::new(move |error| {
                recorded
                    .lock()
                    .expect("diagnostics")
                    .push(error.safe_diagnostic());
                report_signal.notify_one();
            })),
        );
        let mut requests = Vec::new();
        for expected in 1..=8 {
            requests.push(request(&service));
            subscribers(&service, expected).await;
        }
        gate.release();
        let mut errors = Vec::new();
        for request in requests {
            errors.push(
                request
                    .await
                    .expect("waiter task")
                    .expect_err("shared failure"),
            );
        }
        let first = &errors[0];
        assert!(errors.iter().all(|error| Arc::ptr_eq(first, error)));
        if panic {
            assert!(matches!(first.as_ref(), FlightError::Task(error) if error.is_panic()));
        } else {
            assert!(
                matches!(first.as_ref(), FlightError::Source(SourceError::InvalidStructure(message)) if message.contains("private /tmp"))
            );
        }
        tokio::time::timeout(Duration::from_secs(5), reported.notified())
            .await
            .expect("failure diagnostic");
        let expected = if panic {
            "analysis_failure category=task"
        } else {
            "analysis_failure category=source"
        };
        assert_eq!(*diagnostics.lock().expect("diagnostics"), vec![expected]);
        assert_eq!(service.permits.available_permits(), 2);
        assert!(service.state.lock().expect("state").flights.is_empty());
        assert!(service.state.lock().expect("state").entries.is_empty());
        service
            .response(path(), config())
            .await
            .expect("stable retry");
        assert_eq!(calls.load(Ordering::SeqCst), 2);
        assert_eq!(diagnostics.lock().expect("diagnostics").len(), 1);
    }
}

struct BrokenWriter;
impl std::io::Write for BrokenWriter {
    fn write(&mut self, _: &[u8]) -> std::io::Result<usize> {
        Err(std::io::Error::new(
            std::io::ErrorKind::BrokenPipe,
            "closed diagnostic sink",
        ))
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn failed_writes_and_panicking_reporters_cannot_strand_flights_or_prevent_retry() {
    use axum::{http::StatusCode, response::IntoResponse};
    for panic in [false, true] {
        let calls = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&calls);
        let reports = Arc::new(AtomicUsize::new(0));
        let report_count = Arc::clone(&reports);
        let reported = Arc::new(tokio::sync::Notify::new());
        let report_signal = Arc::clone(&reported);
        let (gate, _release) = gate();
        let operation_gate = Arc::clone(&gate);
        let state = Arc::new(Mutex::new(AnalysisState::default()));
        let report_state = Arc::clone(&state);
        let service = Arc::new(
            AnalysisService::with_state(
                state,
                Arc::new(move |_, _, _| {
                    let attempt = count.fetch_add(1, Ordering::SeqCst);
                    if attempt == 0 {
                        operation_gate.wait();
                    }
                    if attempt < 2 {
                        Err(FlightError::Source(SourceError::InvalidStructure(
                            "controlled source failure".into(),
                        )))
                    } else {
                        Ok(response(4))
                    }
                }),
            )
            .with_reporter(Arc::new(move |error| {
                // Reporting must run after publication/removal, without the state lock.
                let state = report_state
                    .try_lock()
                    .expect("reporting outside state lock");
                let cleaned_up = state.flights.is_empty() && state.entries.is_empty();
                drop(state);
                assert!(cleaned_up, "flight lifecycle completed before reporting");
                report_count.fetch_add(1, Ordering::SeqCst);
                report_signal.notify_one();
                if panic {
                    panic!("controlled reporter panic");
                }
                write_failure_diagnostic(&mut BrokenWriter, error);
            })),
        );
        let mut requests = Vec::new();
        for expected in 1..=8 {
            requests.push(request(&service));
            subscribers(&service, expected).await;
        }
        gate.release();
        let mut failures = Vec::new();
        for request in requests {
            failures.push(
                tokio::time::timeout(Duration::from_secs(5), request)
                    .await
                    .expect("waiter completion despite failing reporter")
                    .expect("waiter task")
                    .expect_err("source failure"),
            );
        }
        assert!(failures
            .iter()
            .all(|error| Arc::ptr_eq(&failures[0], error)));
        for error in failures {
            assert_eq!(
                super::super::error::AppError::Shared(error)
                    .into_response()
                    .status(),
                StatusCode::UNPROCESSABLE_ENTITY
            );
        }
        tokio::time::timeout(Duration::from_secs(5), reported.notified())
            .await
            .expect("first report attempted");
        assert_eq!(reports.load(Ordering::SeqCst), 1);
        assert_eq!(service.permits.available_permits(), 2);
        assert!(service.state.lock().expect("state").flights.is_empty());
        let retry =
            tokio::time::timeout(Duration::from_secs(5), service.response(path(), config()))
                .await
                .expect("failed request can retry")
                .expect_err("second source failure");
        assert!(matches!(&*retry, FlightError::Source(_)));
        tokio::time::timeout(Duration::from_secs(5), reported.notified())
            .await
            .expect("second report attempted");
        let stable =
            tokio::time::timeout(Duration::from_secs(5), service.response(path(), config()))
                .await
                .expect("stable retry completes")
                .expect("stable response");
        let warm = service
            .response(path(), config())
            .await
            .expect("cached stable response");
        assert!(Arc::ptr_eq(&stable, &warm));
        assert_eq!(calls.load(Ordering::SeqCst), 3);
        assert_eq!(reports.load(Ordering::SeqCst), 2);
        assert_eq!(service.permits.available_permits(), 2);
        assert!(service.state.lock().expect("state").flights.is_empty());
    }
}

#[tokio::test]
async fn panicking_preflight_reporter_preserves_the_fingerprint_error() {
    let temp = TempSession::new();
    fs::remove_file(&temp.0).expect("remove source before fingerprint");
    let service = Arc::new(
        AnalysisService::new(Arc::new(|_, _, _| panic!("executor must not run")))
            .with_reporter(Arc::new(|_| panic!("controlled preflight reporter panic"))),
    );
    let error = tokio::time::timeout(
        Duration::from_secs(5),
        service.response(temp.0.clone(), config()),
    )
    .await
    .expect("preflight completes")
    .expect_err("missing source");
    assert!(
        matches!(&*error, FlightError::Io(error) if error.kind() == std::io::ErrorKind::NotFound)
    );
    assert!(service.state.lock().expect("state").flights.is_empty());
    assert_eq!(service.permits.available_permits(), 2);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn oversized_uncached_success_fans_out_then_next_request_starts_a_new_flight() {
    let calls = Arc::new(AtomicUsize::new(0));
    let (gate, _release) = gate();
    let operation_gate = Arc::clone(&gate);
    let count = Arc::clone(&calls);
    let state = Arc::new(Mutex::new(AnalysisState::with_limits(4, 1)));
    let service = Arc::new(AnalysisService::with_state(
        state,
        Arc::new(move |_, _, _| {
            count.fetch_add(1, Ordering::SeqCst);
            operation_gate.wait();
            Ok(response(4))
        }),
    ));
    let first = request(&service);
    subscribers(&service, 1).await;
    let second = request(&service);
    subscribers(&service, 2).await;
    let registered = service
        .state
        .lock()
        .expect("state")
        .flights
        .values()
        .next()
        .expect("registered flight")
        .clone();
    gate.release();
    let first = first.await.expect("first task").expect("first success");
    let second = second.await.expect("second task").expect("second success");
    assert!(Arc::ptr_eq(&first, &second));
    let late = registered.result.subscribe();
    let late_result = late
        .borrow()
        .clone()
        .expect("retained result")
        .expect("late success");
    assert!(Arc::ptr_eq(&first, &late_result));
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert!(service.state.lock().expect("state").flights.is_empty());
    assert!(service.state.lock().expect("state").entries.is_empty());
    let later = service
        .response(path(), config())
        .await
        .expect("later uncached success");
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    assert!(!Arc::ptr_eq(&first, &later));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn source_changed_after_blocking_execution_starts_is_not_cached() {
    let temp = TempSession::new();
    let (gate, _release) = gate();
    let operation_gate = Arc::clone(&gate);
    let started = Arc::new(tokio::sync::Notify::new());
    let operation_started = Arc::clone(&started);
    let service = Arc::new(AnalysisService::new(Arc::new(move |path, config, key| {
        operation_started.notify_one();
        operation_gate.wait();
        execute_analysis(path, config, key)
    })));
    let operation_service = Arc::clone(&service);
    let operation_path = temp.0.clone();
    let operation =
        tokio::spawn(async move { operation_service.response(operation_path, config()).await });
    tokio::time::timeout(Duration::from_secs(5), started.notified())
        .await
        .expect("blocking execution started");
    let mut bytes = fs::read(&temp.0).expect("source");
    bytes.push(b'\n');
    fs::write(&temp.0, bytes).expect("changed source");
    gate.release();
    let error = operation
        .await
        .expect("operation task")
        .expect_err("source changed during operation");
    assert!(matches!(&*error, FlightError::SourceChanged));
    assert!(service.state.lock().expect("state").entries.is_empty());
    assert!(service.state.lock().expect("state").flights.is_empty());
    fs::copy(path(), &temp.0).expect("restore stable fixture");
    service
        .response(temp.0.clone(), config())
        .await
        .expect("stable retry");
}

struct TempSession(PathBuf);
impl TempSession {
    fn new() -> Self {
        let name = format!(
            "highwater-flight-{}-{}.jsonl",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos()
        );
        let destination = std::env::temp_dir().join(name);
        fs::copy(path(), &destination).expect("temporary fixture");
        Self(destination)
    }
}
impl Drop for TempSession {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn source_change_or_disappearance_after_registration_is_noncached_and_retryable() {
    for vanish in [false, true] {
        let temp = TempSession::new();
        let service = Arc::new(AnalysisService::new(Arc::new(execute_analysis)));
        let held = Arc::clone(&service.permits)
            .acquire_many_owned(2)
            .await
            .expect("all permits");
        let job_service = Arc::clone(&service);
        let job_path = temp.0.clone();
        let request = tokio::spawn(async move { job_service.response(job_path, config()).await });
        subscribers(&service, 1).await;
        if vanish {
            fs::remove_file(&temp.0).expect("remove source");
        } else {
            let mut bytes = fs::read(&temp.0).expect("read source");
            bytes.push(b'\n');
            fs::write(&temp.0, bytes).expect("change source");
        }
        drop(held);
        let error = request
            .await
            .expect("request task")
            .expect_err("source no longer matches initial identity");
        if vanish {
            assert!(
                matches!(&*error, FlightError::Io(source) if source.kind() == std::io::ErrorKind::NotFound)
            );
        } else {
            assert!(matches!(&*error, FlightError::SourceChanged));
        }
        assert!(service.state.lock().expect("state").entries.is_empty());
        assert!(service.state.lock().expect("state").flights.is_empty());
        fs::copy(path(), &temp.0).expect("restore stable source");
        service
            .response(temp.0.clone(), config())
            .await
            .expect("stable retry");
        assert_eq!(service.state.lock().expect("state").entries.len(), 1);
    }
}
