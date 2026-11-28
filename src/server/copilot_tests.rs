use super::*;
use crate::source::{copilot_reference, SessionLocator};
use axum::{
    body::{to_bytes, Body},
    http::Request,
};
use serde_json::Value;
use sources::{MixedScanner, SourceSet};
use std::{fs, path::Path};
use tower::ServiceExt;

fn home() -> PathBuf {
    fs::canonicalize("fixtures/copilot/home").expect("fixture home")
}

fn copilot_only(homes: Vec<PathBuf>) -> SourceSet {
    SourceSet {
        pi_roots: Vec::new(),
        databases: Vec::new(),
        claude_roots: Vec::new(),
        vscode_user_dirs: Vec::new(),
        codex_homes: Vec::new(),
        copilot_homes: homes,
    }
}

fn scan(sources: &SourceSet) -> Vec<SessionFile> {
    MixedScanner::new(sources, Arc::new(watcher::WatchSignals::default()))
        .scan(Arc::new(AtomicBool::new(false)))
        .expect("discovery")
}

fn reference(number: &str) -> String {
    copilot_reference(&format!("1c000000-0000-4000-8000-000000000{number}"))
}

#[test]
fn catalogue_lists_sessions_with_calls_once() {
    let entries = scan(&copilot_only(vec![home(), home()]));
    let ids: Vec<&str> = entries.iter().map(|entry| entry.id.as_str()).collect();
    let mut expected = [reference("001"), reference("002")];
    expected.sort_unstable();
    let mut ids = ids;
    ids.sort_unstable();
    assert_eq!(ids, expected, "sessions without calls are not listed");
    assert!(entries
        .iter()
        .all(|entry| entry.harness == Harness::Copilot));

    let app = entries
        .iter()
        .find(|entry| entry.id == reference("001"))
        .expect("app session");
    assert_eq!(app.display_name, "Synthetic: app session");
    assert_eq!(app.working_directory.as_deref(), Some("/synthetic/project"));
    assert!(app.started_at.is_some());
    assert!(matches!(
        &app.locator,
        Some(SessionLocator::CopilotFile { path }) if path.starts_with(home())
    ));
    let cli = entries
        .iter()
        .find(|entry| entry.id == reference("002"))
        .expect("CLI session");
    assert_eq!(cli.display_name, "other · 1c000000");

    let json = serde_json::to_value(app).expect("listing");
    assert!(json.get("locator").is_none());
    assert!(!json.to_string().contains("fixtures"));
}

#[test]
fn copilot_home_comes_from_the_flag_then_copilot_home_then_the_home_folder() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let home_folder = fs::canonicalize(directory.path()).expect("home");
    let data = home_folder.join("data");
    let configured = |homes: Vec<PathBuf>, env: Option<&Path>, pi: Option<PathBuf>| {
        SourceSet::configured(
            pi.into_iter().collect(),
            &super::sources::default_pi_roots(&home_folder, |_| None),
            Vec::new(),
            Vec::new(),
            &home_folder,
            &data,
            None,
            Vec::new(),
            &[],
            Vec::new(),
            None,
            homes,
            env,
        )
    };

    // A Copilot folder without `session-state` (one that only holds settings) is not used.
    fs::create_dir_all(home_folder.join(".copilot")).expect("settings only");
    assert!(configured(Vec::new(), None, None).is_err());
    let default = home_folder.join(".copilot");
    fs::create_dir_all(default.join("session-state")).expect("default home");
    assert_eq!(
        configured(Vec::new(), None, None)
            .expect("~/.copilot")
            .copilot_homes,
        vec![default]
    );
    let from_env = home_folder.join("elsewhere");
    fs::create_dir_all(from_env.join("session-state")).expect("COPILOT_HOME");
    assert_eq!(
        configured(Vec::new(), Some(&from_env), None)
            .expect("COPILOT_HOME")
            .copilot_homes,
        vec![from_env]
    );
    assert_eq!(
        configured(vec![home()], None, None)
            .expect("explicit")
            .copilot_homes,
        vec![home()]
    );
    let pi = home_folder.join("pi");
    fs::create_dir_all(&pi).expect("Pi root");
    assert!(configured(Vec::new(), None, Some(pi))
        .expect("Pi only")
        .copilot_homes
        .is_empty());
}

#[tokio::test]
async fn a_session_is_analysed_with_a_coverage_notice_and_checkpoint_total() {
    use std::io::Write;

    let directory = tempfile::tempdir().expect("temporary directory");
    let copy = copied_home(directory.path(), "home");
    let events = copy
        .join("session-state")
        .join("1c000000-0000-4000-8000-000000000001")
        .join("events.jsonl");
    let files = copilot_only(vec![copy]);
    let catalog = Arc::new(SessionCatalog::new("0".repeat(32), scan(&files)));
    let id = reference("001");
    let (live_state, mut revisions) = watch::channel(LiveState {
        generation: "0".repeat(32),
        revision: 0,
        availability: LiveAvailability::Active,
    });
    let (shutdown, _) = watch::channel(false);
    let (controls, _) = mpsc::channel(32);
    let app = router(AppState {
        catalog: Arc::clone(&catalog),
        live_state: live_state.clone(),
        shutdown: shutdown.clone(),
        coordinator: Arc::new(ScanCoordinator { controls }),
        config: AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
        },
        analysis: Arc::new(AnalysisService::new(Arc::new(execute_analysis))),
    });
    let list = || {
        app.clone().oneshot(
            Request::builder()
                .uri("/api/sessions")
                .body(Body::empty())
                .expect("list request"),
        )
    };
    let first = list().await.expect("initial list");
    let old_etag = first.headers()[axum::http::header::ETAG].clone();
    let decode = |response: axum::response::Response| async move {
        serde_json::from_slice::<Value>(&to_bytes(response.into_body(), usize::MAX).await.unwrap())
            .unwrap()
    };
    assert!(decode(first).await["sessions"][0].get("total").is_none());
    let worker = tokio::spawn(totals::run(
        Arc::clone(&catalog),
        live_state,
        shutdown.subscribe(),
    ));
    tokio::time::timeout(Duration::from_secs(5), revisions.changed())
        .await
        .unwrap()
        .unwrap();
    let updated = list().await.expect("updated list");
    assert_ne!(updated.headers()[axum::http::header::ETAG], old_etag);
    assert_eq!(
        decode(updated).await["sessions"][0].get("total"),
        Some(&Value::Null)
    );
    writeln!(
        fs::OpenOptions::new().append(true).open(events).unwrap(),
        r#"{{"type":"session.usage_checkpoint","data":{{"totalNanoAiu":125000000000}}}}"#
    )
    .unwrap();
    assert!(catalog.install(scan(&files)).unwrap());
    tokio::time::timeout(Duration::from_secs(5), revisions.changed())
        .await
        .unwrap()
        .unwrap();
    let json = decode(list().await.unwrap()).await;
    assert_eq!(
        json["sessions"][0]["total"],
        serde_json::json!({
            "usd": 1.25, "kind": "recorded", "partial": false, "sinceMs": null,
        })
    );
    assert!(!catalog.install(scan(&files)).unwrap());
    assert_eq!(decode(list().await.unwrap()).await, json);
    let analysis = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/sessions/{id}/analysis"))
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("analysis");
    assert_eq!(analysis.status(), StatusCode::OK);
    let json: Value = serde_json::from_slice(
        &to_bytes(analysis.into_body(), usize::MAX)
            .await
            .expect("body"),
    )
    .expect("JSON");
    assert_eq!(json["session"]["source"], "copilot");
    assert_eq!(json["session"]["harnessSessionCost"]["totalUsd"], 1.25);
    assert!(json["session"]["harnessSessionCost"]["sinceMs"].is_null());
    let call_total = json["session"]["reportedCostTotal"]
        .as_f64()
        .expect("recorded call cost");
    assert!((call_total - 0.70).abs() < 1e-9, "{call_total}");
    assert_eq!(json["reconstruction"]["status"], "partial");
    let codes = json["reconstruction"]["explanationCodes"].to_string();
    assert!(codes.contains("subagentCallsNotShown"));
    let calls = json["modelCalls"].as_array().expect("calls");
    assert_eq!(calls.len(), 5);
    assert_eq!(calls[3]["stopReason"], "compaction-call");
    assert_eq!(calls[0]["timing"]["basis"], "copilot-usage-duration");
    assert_eq!(calls[0]["timing"]["durationMs"], 2000);

    let events = files.copilot_homes[0]
        .join("session-state/1c000000-0000-4000-8000-000000000001/events.jsonl");
    writeln!(
        fs::OpenOptions::new().append(true).open(events).unwrap(),
        r#"{{"type":"session.usage_checkpoint","data":{{"totalNanoAiu":150000000000}}}}"#
    )
    .unwrap();
    assert!(catalog.install(scan(&files)).unwrap());
    assert!(decode(list().await.unwrap()).await["sessions"][0]
        .get("total")
        .is_none());
    tokio::time::timeout(Duration::from_secs(5), revisions.changed())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        decode(list().await.unwrap()).await["sessions"][0]["total"]["usd"],
        1.5
    );
    shutdown.send_replace(true);
    worker.await.unwrap();
}

/// A copy of fixture session `001` in a temporary Copilot home.
fn copied_home(directory: &Path, name: &str) -> PathBuf {
    let copy = fs::canonicalize(directory).expect("directory").join(name);
    let folder = copy
        .join("session-state")
        .join("1c000000-0000-4000-8000-000000000001");
    fs::create_dir_all(&folder).expect("session folder");
    let source = home()
        .join("session-state")
        .join("1c000000-0000-4000-8000-000000000001");
    for file in ["events.jsonl", "workspace.yaml"] {
        fs::copy(source.join(file), folder.join(file)).expect("copy");
    }
    copy
}

#[test]
fn a_session_in_two_home_folders_is_listed_once() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let first = copied_home(directory.path(), "first");
    let second = copied_home(directory.path(), "second");
    let entries = scan(&copilot_only(vec![first, second]));
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].id, reference("001"));
}

#[test]
fn renaming_a_session_changes_its_cache_key_and_etag() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let copy = copied_home(directory.path(), "home");
    let folder = copy
        .join("session-state")
        .join("1c000000-0000-4000-8000-000000000001");
    let config = AnalysisConfig {
        tokenization: TokenizationPolicy::Heuristic,
        perf_diagnostics: false,
    };
    let events = folder.join("events.jsonl");
    let before = analysis::file_cache_key(&events, analysis::FileReader::Copilot, config)
        .expect("key before");
    fs::write(folder.join("workspace.yaml"), "name: Renamed session\n").expect("rename");
    let after = analysis::file_cache_key(&events, analysis::FileReader::Copilot, config)
        .expect("key after");
    assert_ne!(before, after);
    assert_ne!(
        analysis::etag_for_key(&before),
        analysis::etag_for_key(&after)
    );
}
