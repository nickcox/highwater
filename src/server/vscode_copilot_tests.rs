use super::*;
use crate::source::SessionLocator;
use axum::{
    body::{to_bytes, Body},
    http::Request,
};
use serde_json::Value;
use sources::{MixedScanner, SourceSet};
use std::fs;
use tower::ServiceExt;

fn user_dir() -> PathBuf {
    fs::canonicalize("fixtures/vscode-copilot/User").expect("fixture folder")
}

fn vscode_only(user_dirs: Vec<PathBuf>) -> SourceSet {
    SourceSet {
        pi_root: None,
        databases: Vec::new(),
        claude_roots: Vec::new(),
        vscode_user_dirs: user_dirs,
        codex_homes: Vec::new(),
    }
}

fn scan(sources: &SourceSet) -> Vec<SessionFile> {
    MixedScanner::new(sources, Arc::new(watcher::WatchSignals::default()))
        .scan(Arc::new(AtomicBool::new(false)))
        .expect("discovery")
}

#[test]
fn sessions_with_requests_are_listed_once() {
    let entries = scan(&vscode_only(vec![user_dir(), user_dir()]));
    let mut names: Vec<&str> = entries
        .iter()
        .map(|entry| entry.display_name.as_str())
        .collect();
    names.sort();
    assert_eq!(
        names,
        [
            "Fix the failing parser test",
            "Summarise the service",
            "What does git rebase --onto do?"
        ]
    );
    let agent = entries
        .iter()
        .find(|entry| entry.display_name == "Fix the failing parser test")
        .expect("agent session");
    assert_eq!(agent.harness, "vscode-copilot");
    assert_eq!(
        agent.id,
        sources::vscode_copilot_reference("11111111-agent")
    );
    assert_eq!(
        agent.working_directory.as_deref(),
        Some("/home/dev/my project")
    );
    assert!(agent.started_at.is_some());
    assert!(matches!(
        agent.locator,
        Some(SessionLocator::VsCodeCopilotFile { .. })
    ));
    let json = serde_json::to_value(agent).expect("listing");
    assert!(json.get("locator").is_none());
    assert!(!json.to_string().contains("fixtures"));
}

#[test]
fn vscode_defaults_are_used_when_they_exist_unless_pi_is_explicit() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let home = fs::canonicalize(directory.path()).expect("home");
    let data = home.join("data");
    let existing = home.join("Code/User");
    fs::create_dir_all(&existing).expect("user folder");
    let missing = home.join("Code - Insiders/User");
    let defaults = [existing.clone(), missing];

    let sources = SourceSet::configured(
        None,
        Vec::new(),
        Vec::new(),
        &home,
        &data,
        None,
        Vec::new(),
        &defaults,
        Vec::new(),
        None,
    )
    .expect("VS Code defaults");
    assert_eq!(sources.vscode_user_dirs, vec![existing.clone()]);

    let pi = home.join("pi");
    fs::create_dir_all(&pi).expect("Pi root");
    let pi_only = SourceSet::configured(
        Some(pi.clone()),
        Vec::new(),
        Vec::new(),
        &home,
        &data,
        None,
        Vec::new(),
        &defaults,
        Vec::new(),
        None,
    )
    .expect("Pi only");
    assert!(pi_only.vscode_user_dirs.is_empty());

    let explicit = SourceSet::configured(
        Some(pi),
        Vec::new(),
        Vec::new(),
        &home,
        &data,
        None,
        vec![user_dir()],
        &defaults,
        Vec::new(),
        None,
    )
    .expect("explicit VS Code folder");
    assert_eq!(explicit.vscode_user_dirs, vec![user_dir()]);
}

#[test]
fn the_platform_defaults_name_code_and_insiders() {
    let home = PathBuf::from("/home/dev");
    let defaults = sources::default_vscode_user_dirs(&home);
    assert_eq!(defaults.len(), 2);
    assert!(defaults[0].ends_with("Code/User"));
    assert!(defaults[1].ends_with("Code - Insiders/User"));
}

#[tokio::test]
async fn a_session_is_analysed_with_a_coverage_notice() {
    let entries = scan(&vscode_only(vec![user_dir()]));
    let id = sources::vscode_copilot_reference("11111111-agent");
    let (live_state, _) = watch::channel(LiveState {
        generation: "0".repeat(32),
        revision: 0,
        availability: LiveAvailability::Active,
    });
    let (shutdown, _) = watch::channel(false);
    let (controls, _) = mpsc::channel(32);
    let app = router(AppState {
        catalog: Arc::new(SessionCatalog::new("0".repeat(32), entries)),
        live_state,
        shutdown,
        coordinator: Arc::new(ScanCoordinator { controls }),
        config: AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
        },
        analysis: Arc::new(AnalysisService::new(Arc::new(execute_analysis))),
    });
    let analysis = app
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
    assert_eq!(json["session"]["source"], "vscode-copilot");
    assert_eq!(json["session"]["title"], "Fix the failing parser test");
    assert_eq!(json["modelCalls"].as_array().expect("calls").len(), 3);
    assert_eq!(json["reconstruction"]["status"], "partial");
    assert!(json["reconstruction"]["explanationCodes"]
        .to_string()
        .contains("missingHistoricalToolDefinitions"));
}

#[test]
fn copilot_cache_keys_and_etags_differ_from_pi_keys_for_the_same_file() {
    let path = user_dir().join("workspaceStorage/0a1b2c3d/chatSessions/11111111-agent.jsonl");
    let config = AnalysisConfig {
        tokenization: TokenizationPolicy::Heuristic,
        perf_diagnostics: false,
    };
    let pi = analysis_cache_key(&path, config).expect("Pi key");
    let copilot = AnalysisCacheKey {
        reader: super::analysis::FileReader::VsCodeCopilot,
        ..pi.clone()
    };
    assert_ne!(pi, copilot);
    assert_ne!(etag_for_key(&pi), etag_for_key(&copilot));
}

#[test]
fn a_copilot_cache_key_changes_with_its_trace_database() {
    let directory = tempfile::tempdir().expect("temporary folder");
    let user = fs::canonicalize(directory.path())
        .expect("folder")
        .join("User");
    let sessions = user.join("workspaceStorage/abc/chatSessions");
    fs::create_dir_all(&sessions).expect("sessions");
    let session = sessions.join("session.jsonl");
    fs::copy(
        user_dir().join("workspaceStorage/0a1b2c3d/chatSessions/11111111-agent.jsonl"),
        &session,
    )
    .expect("session file");
    let config = AnalysisConfig {
        tokenization: TokenizationPolicy::Heuristic,
        perf_diagnostics: false,
    };
    let key = || {
        super::analysis::file_cache_key(
            &session,
            super::analysis::FileReader::VsCodeCopilot,
            config,
        )
        .expect("key")
    };
    let without = key();
    let database = user.join("globalStorage/github.copilot-chat/agent-traces.db");
    fs::create_dir_all(database.parent().expect("folder")).expect("folder");
    fs::write(&database, "records").expect("database");
    let with = key();
    assert_ne!(without, with);
    assert_ne!(etag_for_key(&without), etag_for_key(&with));
    fs::write(database.with_extension("db-wal"), "more records").expect("log");
    assert_ne!(
        with,
        key(),
        "new records in the write-ahead log change the key"
    );
}
