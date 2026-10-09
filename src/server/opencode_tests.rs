use super::*;
use crate::{opencode::storage::CatalogTracker, source::SessionLocator};
use axum::{
    body::{to_bytes, Body},
    http::Request,
};
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use sources::{MixedScanner, SourceSet};
use tower::ServiceExt;

struct DatabaseFixture {
    _directory: tempfile::TempDir,
    path: PathBuf,
    writer: Connection,
}
impl DatabaseFixture {
    fn new() -> Self {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("synthetic.db");
        let writer = Connection::open(&path).expect("fixture DB");
        writer
            .execute_batch(include_str!("../../fixtures/opencode/legacy-schema.sql"))
            .expect("schema");
        writer.execute("INSERT INTO session (id, directory, title, version, time_created, time_updated) VALUES ('ses_example', '/synthetic', 'Synthetic task', '1.4.0', 10, 100)", []).expect("session");
        let tokens = json!({"input":80,"output":20,"reasoning":0,"cache":{"read":10,"write":0}});
        for (id, at, data) in [
            ("user", 10, json!({"role":"user"})),
            (
                "assistant",
                20,
                json!({"role":"assistant","parentID":"user","providerID":"openai","modelID":"gpt-4.1","time":{"created":20,"completed":25},"tokens":tokens,"cost":0.2,"finish":"stop"}),
            ),
            (
                "next",
                30,
                json!({"role":"assistant","parentID":"user","providerID":"openai","modelID":"gpt-4.1","time":{"created":30,"completed":35},"tokens":tokens,"cost":0.2,"finish":"stop"}),
            ),
        ] {
            writer
                .execute(
                    "INSERT INTO message VALUES (?1,'ses_example',?2,?2,?3)",
                    params![id, at, data.to_string()],
                )
                .expect("message");
        }
        for (id, message, data) in [
            (
                "user_text",
                "user",
                json!({"type":"text","text":"Synthetic user"}),
            ),
            (
                "assistant_text",
                "assistant",
                json!({"type":"text","text":"aaa"}),
            ),
            ("assistant_start", "assistant", json!({"type":"step-start"})),
            (
                "assistant_finish",
                "assistant",
                json!({"type":"step-finish","tokens":tokens,"cost":0.2}),
            ),
            ("next_start", "next", json!({"type":"step-start"})),
            (
                "next_finish",
                "next",
                json!({"type":"step-finish","tokens":tokens,"cost":0.2}),
            ),
        ] {
            writer
                .execute(
                    "INSERT INTO part VALUES (?1,?2,'ses_example',10,10,?3)",
                    params![id, message, data.to_string()],
                )
                .expect("part");
        }
        Self {
            _directory: directory,
            path,
            writer,
        }
    }
    fn add_modern(&self) {
        self.writer
            .execute_batch(include_str!("../../fixtures/opencode/modern-schema.sql"))
            .expect("modern schema");
        self.writer
            .execute_batch(
                &include_str!("../../fixtures/opencode/modern.sql")
                    .replace("ses_modern", "ses_example"),
            )
            .expect("modern records");
    }
    fn sources(&self) -> SourceSet {
        SourceSet {
            pi_root: None,
            databases: vec![self.path.clone()],
        }
    }
    fn locator(&self) -> SessionLocator {
        SessionLocator::OpenCode {
            database: self.path.clone(),
            native_id: "ses_example".into(),
        }
    }
    fn edit(&self) {
        self.writer
            .execute(
                "UPDATE part SET data = ?1 WHERE id = 'assistant_text'",
                [json!({"type":"text","text":"bbb"}).to_string()],
            )
            .expect("same-size edit");
    }
    fn wal(&self) {
        self.writer.execute_batch("PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0; PRAGMA wal_checkpoint(TRUNCATE);").expect("WAL fixture");
    }
}
fn config() -> AnalysisConfig {
    AnalysisConfig {
        tokenization: TokenizationPolicy::Heuristic,
        perf_diagnostics: false,
    }
}
fn scanner(sources: &SourceSet) -> MixedScanner {
    MixedScanner::new(sources, Arc::new(watcher::WatchSignals::default()))
}
fn scan(scanner: &MixedScanner) -> Vec<SessionFile> {
    scanner
        .scan(Arc::new(AtomicBool::new(false)))
        .expect("discovery")
}
fn app(entries: Vec<SessionFile>, service: Arc<AnalysisService>) -> axum::Router {
    let (live_state, _) = watch::channel(LiveState {
        generation: "0".repeat(32),
        revision: 0,
        availability: LiveAvailability::Active,
    });
    let (shutdown, _) = watch::channel(false);
    let (controls, _) = mpsc::channel(32);
    router(AppState {
        catalog: Arc::new(SessionCatalog::new("0".repeat(32), entries)),
        live_state,
        shutdown,
        coordinator: Arc::new(ScanCoordinator { controls }),
        config: config(),
        analysis: service,
    })
}
fn request(id: &str, etag: Option<&str>) -> Request<Body> {
    let mut builder = Request::builder().uri(format!("/api/sessions/{id}/analysis"));
    if let Some(etag) = etag {
        builder = builder.header(header::IF_NONE_MATCH, etag);
    }
    builder.body(Body::empty()).expect("request")
}

#[tokio::test]
async fn modern_http_wal_refresh_and_generation_switch_never_reuse_stale_analysis() {
    let fixture = DatabaseFixture::new();
    fixture.add_modern();
    fixture.wal();
    let scanner = scanner(&fixture.sources());
    let entries = scan(&scanner);
    assert_eq!(entries.len(), 1, "same ID in two generations lists once");
    let id = entries[0].id.clone();
    let service = Arc::new(AnalysisService::new(Arc::new(execute_analysis)));
    let app = app(entries, service);
    let first = app
        .clone()
        .oneshot(request(&id, None))
        .await
        .expect("modern response");
    assert_eq!(first.status(), StatusCode::OK);
    let etag = first.headers()[header::ETAG]
        .to_str()
        .expect("etag")
        .to_owned();
    let payload: Value =
        serde_json::from_slice(&to_bytes(first.into_body(), usize::MAX).await.expect("body"))
            .expect("analysis");
    assert_eq!(payload["modelCalls"].as_array().expect("calls").len(), 3);
    assert!(payload["reconstruction"]["explanationCodes"]
        .as_array()
        .expect("coverage")
        .contains(&json!("storageGenerationSelection")));
    assert_eq!(
        app.clone()
            .oneshot(request(&id, Some(&etag)))
            .await
            .expect("unchanged")
            .status(),
        StatusCode::NOT_MODIFIED
    );
    let before = std::fs::read(&fixture.path).expect("main database");
    fixture.writer.execute("UPDATE session_message SET data=replace(data,'Synthetic modern question','Synthetic modern revision') WHERE id='msg_user'", []).expect("WAL-only body update");
    assert_eq!(
        std::fs::read(&fixture.path).expect("unchanged main"),
        before
    );
    let changed = app
        .clone()
        .oneshot(request(&id, Some(&etag)))
        .await
        .expect("fresh modern response");
    assert_eq!(changed.status(), StatusCode::OK);
    let changed_etag = changed.headers()[header::ETAG]
        .to_str()
        .expect("new etag")
        .to_owned();
    assert_ne!(etag, changed_etag);
    let payload: Value = serde_json::from_slice(
        &to_bytes(changed.into_body(), usize::MAX)
            .await
            .expect("body"),
    )
    .expect("analysis");
    assert!(payload["contextItems"]
        .as_array()
        .expect("items")
        .iter()
        .any(|item| item["preview"]["text"]
            .as_str()
            .is_some_and(|text| text.contains("Synthetic modern revision"))));
    fixture
        .writer
        .execute("UPDATE session SET time_updated=101", [])
        .expect("legacy writes after migration");
    let legacy = app
        .oneshot(request(&id, Some(&changed_etag)))
        .await
        .expect("generation switch");
    assert_eq!(legacy.status(), StatusCode::OK);
    let payload: Value = serde_json::from_slice(
        &to_bytes(legacy.into_body(), usize::MAX)
            .await
            .expect("body"),
    )
    .expect("legacy analysis");
    assert_eq!(
        payload["modelCalls"]
            .as_array()
            .expect("legacy calls")
            .len(),
        2
    );
}

#[test]
fn modern_only_catalog_and_tracker_do_not_need_legacy_tables() {
    let fixture = DatabaseFixture::new();
    fixture.add_modern();
    fixture
        .writer
        .execute_batch("DROP TABLE part; DROP TABLE message; DROP TABLE session;")
        .expect("native modern-only install");
    fixture.wal();
    let scanner = scanner(&fixture.sources());
    let before = scan(&scanner);
    assert_eq!(before.len(), 1);
    assert_eq!(before[0].display_name, "Synthetic modern task");
    fixture.writer.execute("UPDATE session_message SET data=replace(data,'Synthetic modern question','Synthetic modern revision') WHERE id='msg_user'", []).expect("body-only commit");
    let after = scan(&scanner);
    assert_ne!(before, after);
    assert_eq!(before[0].modified_at, after[0].modified_at);
    fixture
        .writer
        .execute_batch("DELETE FROM session_message; DELETE FROM session_v2")
        .expect("delete modern session");
    assert!(scan(&scanner).is_empty());
}

#[test]
fn sqlite_catalog_tracker_detects_wal_commits_without_session_timestamps() {
    let fixture = DatabaseFixture::new();
    fixture.wal();
    let mut tracker = CatalogTracker::new(&fixture.path).expect("tracker");
    let before = tracker.observe(&fixture.path).expect("version");
    let main = std::fs::read(&fixture.path).expect("main bytes");
    fixture.edit();
    assert_eq!(main, std::fs::read(&fixture.path).expect("unchanged main"));
    assert!(tracker.observe(&fixture.path).expect("WAL version") > before);
    let next = tracker.observe(&fixture.path).expect("stable version");
    assert_eq!(next, tracker.observe(&fixture.path).expect("unchanged"));
}

#[test]
fn mixed_catalog_metadata_has_harness_relationships_and_no_database_locator() {
    let fixture = DatabaseFixture::new();
    fixture.writer.execute("INSERT INTO session (id,parent_id,directory,title,version,time_created,time_updated) VALUES ('ses_child','ses_example','/synthetic','Child','1.4.0',20,200)", []).expect("child");
    let mut sources = fixture.sources();
    sources.pi_root = Some(std::fs::canonicalize("fixtures/pi").expect("Pi fixtures"));
    let entries = scan(&scanner(&sources));
    assert!(entries.iter().any(|entry| entry.harness == "pi"));
    let child = entries
        .iter()
        .find(|entry| entry.display_name == "Child")
        .expect("child");
    assert_eq!(child.harness, "opencode");
    assert_eq!(
        child.parent_reference.as_deref(),
        Some(sources::reference("ses_example").as_str())
    );
    let json = serde_json::to_value(child).expect("listing");
    assert!(json["byteSize"].is_null());
    assert!(json.get("path").is_none());
    assert!(json.get("locator").is_none());
    assert!(!json.to_string().contains("synthetic.db"));
}

#[test]
fn database_only_defaults_and_explicit_pi_only_configuration_are_supported() {
    let fixture = DatabaseFixture::new();
    let home = fixture._directory.path().join("home");
    let data = fixture._directory.path().join("data");
    std::fs::create_dir_all(data.join("opencode")).expect("data home");
    std::fs::copy(&fixture.path, data.join("opencode/opencode.db")).expect("default DB");
    let defaults =
        SourceSet::configured(None, Vec::new(), &home, &data).expect("OpenCode-only defaults");
    assert!(defaults.pi_root.is_none());
    assert_eq!(defaults.databases.len(), 1);
    let pi = std::fs::canonicalize("fixtures/pi").expect("Pi fixtures");
    let explicit = SourceSet::configured(Some(pi), Vec::new(), &home, &data).expect("Pi-only");
    assert!(explicit.databases.is_empty());
    assert!(SourceSet::configured(Some(home.join("missing")), Vec::new(), &home, &data).is_err());
    assert!(SourceSet::configured(None, vec![data.join("missing.db")], &home, &data).is_err());
}

#[test]
fn database_catalog_changes_for_part_only_commits_and_removes_deleted_sessions() {
    let fixture = DatabaseFixture::new();
    fixture.wal();
    let scanner = scanner(&fixture.sources());
    let before = scan(&scanner);
    assert_eq!(before, scan(&scanner));
    fixture.edit();
    let after = scan(&scanner);
    assert_ne!(before, after);
    assert_eq!(before[0].modified_at, after[0].modified_at);
    fixture
        .writer
        .execute("DELETE FROM session", [])
        .expect("delete session");
    assert!(scan(&scanner).is_empty());
}

#[test]
fn failed_database_retains_its_catalogue_while_healthy_sources_advance() {
    let fixture = DatabaseFixture::new();
    let healthy = DatabaseFixture::new();
    let sources = SourceSet {
        pi_root: None,
        databases: vec![fixture.path.clone(), healthy.path.clone()],
    };
    let signals = Arc::new(watcher::WatchSignals::default());
    let scanner = MixedScanner::new(&sources, Arc::clone(&signals));
    let before = scan(&scanner);
    fixture
        .writer
        .execute_batch("BEGIN EXCLUSIVE")
        .expect("lock DB");
    healthy
        .writer
        .execute("UPDATE session SET title = 'Healthy change'", [])
        .expect("healthy edit");
    let after = scan(&scanner);
    assert_eq!(after.len(), before.len());
    assert!(after
        .iter()
        .any(|entry| entry.display_name == "Synthetic task"));
    assert!(after
        .iter()
        .any(|entry| entry.display_name == "Healthy change"));
    assert!(signals.sources_degraded.load(Ordering::Acquire));
    assert!(!signals.watcher_failed.load(Ordering::Acquire));
    fixture.writer.execute_batch("ROLLBACK").expect("recover");
    assert_eq!(scan(&scanner).len(), 2);
    assert!(!signals.sources_degraded.load(Ordering::Acquire));
}

#[tokio::test]
async fn database_http_etags_revalidate_snapshots_before_304_and_expose_coverage() {
    let fixture = DatabaseFixture::new();
    fixture.wal();
    let service = Arc::new(AnalysisService::new(Arc::new(execute_analysis)));
    let entries = scan(&scanner(&fixture.sources()));
    let id = entries[0].id.clone();
    let app = app(entries, Arc::clone(&service));
    let first = app
        .clone()
        .oneshot(request(&id, None))
        .await
        .expect("HTTP response");
    assert_eq!(first.status(), StatusCode::OK);
    let etag = first.headers()[header::ETAG]
        .to_str()
        .expect("ETag")
        .to_owned();
    let json: Value =
        serde_json::from_slice(&to_bytes(first.into_body(), usize::MAX).await.expect("body"))
            .expect("JSON");
    assert_eq!(json["schemaVersion"], 11);
    assert_eq!(json["session"]["source"], "opencode");
    assert_eq!(json["reconstruction"]["status"], "partial");
    assert_eq!(json["economics"]["costBasis"], "sourceModelRates");
    assert_eq!(json["modelCalls"][0]["timing"]["durationMs"], Value::Null);
    let cached = app
        .clone()
        .oneshot(request(&id, Some(&etag)))
        .await
        .expect("revalidate");
    assert_eq!(cached.status(), StatusCode::NOT_MODIFIED);
    assert_eq!(service.state.lock().expect("cache").hits, 1);
    fixture.edit();
    let changed = app
        .clone()
        .oneshot(request(&id, Some(&etag)))
        .await
        .expect("changed response");
    assert_eq!(changed.status(), StatusCode::OK);
    assert_ne!(changed.headers()[header::ETAG], etag);
    // Arbitrary DB paths or native IDs are not accepted by catalogue lookup.
    let denied = app
        .oneshot(request("ses_example", None))
        .await
        .expect("unknown reference");
    assert_eq!(denied.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn duplicate_database_native_ids_are_ambiguous_and_cache_entries_are_isolated() {
    let first = DatabaseFixture::new();
    let second = DatabaseFixture::new();
    second.edit();
    let service = Arc::new(AnalysisService::new(Arc::new(execute_analysis)));
    let a = service
        .response_source(first.locator(), config())
        .await
        .expect("first DB");
    let b = service
        .response_source(second.locator(), config())
        .await
        .expect("second DB");
    assert_ne!(a.etag, b.etag);
    assert_ne!(a.body, b.body);
    let sources = SourceSet {
        pi_root: None,
        databases: vec![first.path.clone(), second.path.clone()],
    };
    let entries = scan(&scanner(&sources));
    let id = entries[0].id.clone();
    let response = app(entries, service)
        .oneshot(request(&id, None))
        .await
        .expect("ambiguous lookup");
    assert_eq!(response.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn transient_database_health_recovers_and_lost_watchers_still_refresh() {
    let fixture = DatabaseFixture::new();
    let signals = Arc::new(watcher::WatchSignals::default());
    let scanner = Arc::new(MixedScanner::new(&fixture.sources(), Arc::clone(&signals)));
    let initial = scan(&scanner);
    let catalog = Arc::new(SessionCatalog::new("0".repeat(32), initial));
    let (live_state, _) = watch::channel(LiveState {
        generation: "0".repeat(32),
        revision: 0,
        availability: LiveAvailability::Active,
    });
    let (shutdown, shutdown_receiver) = watch::channel(false);
    let (controls, control_receiver) = mpsc::channel(32);
    let (hints, hint_receiver) = mpsc::channel(32);
    let worker_scanner = Arc::clone(&scanner);
    let worker = tokio::spawn(scan_worker(
        ScanWorkerContext {
            root: PathBuf::new(),
            catalog: Arc::clone(&catalog),
            live_state: live_state.clone(),
            signals: Arc::clone(&signals),
            diagnostics: Arc::new(Diagnostics::default()),
            shutdown: shutdown_receiver,
            scanner: Arc::new(move |_, cancelled| worker_scanner.scan(cancelled)),
        },
        hint_receiver,
        control_receiver,
    ));
    async fn refresh(controls: &mpsc::Sender<ScanControl>) {
        let (sender, receiver) = oneshot::channel();
        controls
            .send(ScanControl::EnsureFresh(sender))
            .await
            .expect("refresh");
        tokio::time::timeout(Duration::from_secs(5), receiver)
            .await
            .expect("bounded refresh")
            .expect("worker")
            .expect("scan");
    }
    fixture
        .writer
        .execute_batch("BEGIN EXCLUSIVE")
        .expect("lock");
    refresh(&controls).await;
    assert_eq!(live_state.borrow().availability, LiveAvailability::Degraded);
    assert_eq!(
        catalog
            .snapshot()
            .expect("retained catalogue")
            .sessions
            .len(),
        1
    );
    assert!(!signals.watcher_failed.load(Ordering::Acquire));
    fixture.writer.execute_batch("ROLLBACK").expect("unlock");
    refresh(&controls).await;
    assert_eq!(live_state.borrow().availability, LiveAvailability::Active);
    assert_eq!(catalog.snapshot().expect("unchanged catalogue").revision, 0);
    signals.watcher_failed.store(true, Ordering::Release);
    signals.wake.notify_one();
    fixture.edit();
    // Exercise the same hint path as the two-second polling fallback, without
    // an HTTP EnsureFresh request or a healthy native watcher.
    hints
        .send(watcher::WatchHint::Filesystem)
        .await
        .expect("poll hint");
    tokio::time::timeout(Duration::from_secs(5), async {
        while catalog.snapshot().expect("fallback catalogue").revision == 0 {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("poll-driven update");
    assert_eq!(live_state.borrow().availability, LiveAvailability::Degraded);
    assert!(catalog.snapshot().expect("fallback catalogue").revision > 0);
    shutdown.send_replace(true);
    tokio::time::timeout(Duration::from_secs(5), worker)
        .await
        .expect("shutdown")
        .expect("worker");
}

#[tokio::test]
async fn database_checkpoint_busy_and_deletion_never_return_stale_304() {
    let fixture = DatabaseFixture::new();
    let service = Arc::new(AnalysisService::new(Arc::new(execute_analysis)));
    let entries = scan(&scanner(&fixture.sources()));
    let id = entries[0].id.clone();
    let app = app(entries, service);
    let first = app
        .clone()
        .oneshot(request(&id, None))
        .await
        .expect("first");
    let etag = first.headers()[header::ETAG]
        .to_str()
        .expect("etag")
        .to_owned();
    fixture
        .writer
        .execute_batch("BEGIN EXCLUSIVE")
        .expect("lock");
    let busy = app
        .clone()
        .oneshot(request(&id, Some(&etag)))
        .await
        .expect("busy");
    assert_eq!(busy.status(), StatusCode::SERVICE_UNAVAILABLE);
    fixture.writer.execute_batch("ROLLBACK").expect("unlock");
    fixture.wal();
    fixture
        .writer
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE)")
        .expect("checkpoint");
    assert_eq!(
        app.clone()
            .oneshot(request(&id, Some(&etag)))
            .await
            .expect("checkpoint response")
            .status(),
        StatusCode::NOT_MODIFIED
    );
    fixture
        .writer
        .execute("DELETE FROM session", [])
        .expect("delete");
    assert_ne!(
        app.oneshot(request(&id, Some(&etag)))
            .await
            .expect("deleted response")
            .status(),
        StatusCode::NOT_MODIFIED
    );
}

#[tokio::test]
async fn database_flights_coalesce_while_queued_and_survive_initiator_cancellation() {
    let fixture = DatabaseFixture::new();
    let service = Arc::new(AnalysisService::new(Arc::new(execute_analysis)));
    let permits = Arc::clone(&service.permits)
        .acquire_many_owned(2)
        .await
        .expect("occupy permits");
    let locator = fixture.locator();
    let first_service = Arc::clone(&service);
    let first_locator = locator.clone();
    let first =
        tokio::spawn(async move { first_service.response_source(first_locator, config()).await });
    tokio::task::yield_now().await;
    first.abort();
    let second_service = Arc::clone(&service);
    let second =
        tokio::spawn(async move { second_service.response_source(locator, config()).await });
    drop(permits);
    let result = tokio::time::timeout(Duration::from_secs(5), second)
        .await
        .expect("completion")
        .expect("task")
        .expect("analysis");
    assert!(!result.body.is_empty());
    assert_eq!(service.state.lock().expect("cache").entries.len(), 1);
}
