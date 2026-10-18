use super::*;
use crate::{claude_code::FileKind, source::SessionLocator};
use axum::{
    body::{to_bytes, Body},
    http::Request,
};
use serde_json::Value;
use sources::{MixedScanner, SourceSet};
use std::fs;
use tower::ServiceExt;

fn fixture_root() -> PathBuf {
    fs::canonicalize("fixtures/claude-code/projects").expect("fixture root")
}

fn claude_only(roots: Vec<PathBuf>) -> SourceSet {
    SourceSet {
        pi_root: None,
        databases: Vec::new(),
        claude_roots: roots,
        vscode_user_dirs: Vec::new(),
        codex_homes: Vec::new(),
    }
}

fn scan(sources: &SourceSet) -> Vec<SessionFile> {
    MixedScanner::new(sources, Arc::new(watcher::WatchSignals::default()))
        .scan(Arc::new(AtomicBool::new(false)))
        .expect("discovery")
}

fn transcript_path(entry: &SessionFile) -> &FsPath {
    match &entry.locator {
        Some(SessionLocator::ClaudeCodeFile { path, .. }) => path,
        _ => panic!("not a Claude Code entry"),
    }
}

fn entry_for<'a>(entries: &'a [SessionFile], fixture: &str) -> &'a SessionFile {
    let path = fixture_root().join(fixture);
    entries
        .iter()
        .find(|entry| transcript_path(entry) == path)
        .unwrap_or_else(|| panic!("{fixture} is not in the catalogue"))
}

fn expected_results() -> Vec<Value> {
    let mut results = Vec::new();
    for entry in fs::read_dir("fixtures/claude-code/expected").expect("expected directory") {
        let path = entry.expect("entry").path();
        if path.file_stem().and_then(|stem| stem.to_str()) != Some("discovery") {
            results.push(
                serde_json::from_str(&fs::read_to_string(path).expect("read")).expect("JSON"),
            );
        }
    }
    results
}

#[test]
fn catalogue_entries_match_the_expected_listings() {
    let entries = scan(&claude_only(vec![fixture_root()]));
    assert_eq!(entries.len(), 18);
    for expected in expected_results() {
        let fixture = expected["fixture"].as_str().expect("fixture");
        let listing = &expected["listing"];
        let entry = entry_for(&entries, fixture);
        assert_eq!(entry.harness, "claude-code");
        assert_eq!(
            entry.display_name,
            listing["title"].as_str().expect("title"),
            "{fixture}"
        );
        assert_eq!(
            entry.working_directory.as_deref(),
            listing["workingDirectory"].as_str(),
            "{fixture}"
        );
        assert!(entry.started_at.is_some(), "{fixture}");
        assert!(entry.byte_size.is_some_and(|size| size > 0), "{fixture}");
        let kind = match &entry.locator {
            Some(SessionLocator::ClaudeCodeFile { kind, .. }) => *kind,
            _ => unreachable!(),
        };
        match listing["parentFixture"].as_str() {
            Some(parent) => {
                assert_eq!(kind, FileKind::Subagent, "{fixture}");
                assert_eq!(
                    entry.subagent_type.as_deref(),
                    listing["subagent"]["agentType"].as_str(),
                    "{fixture}"
                );
                assert_eq!(
                    entry.parent_reference.as_deref(),
                    Some(entry_for(&entries, parent).id.as_str()),
                    "{fixture}"
                );
            }
            None => {
                assert_eq!(kind, FileKind::Main, "{fixture}");
                assert_eq!(entry.parent_reference, None, "{fixture}");
                assert_eq!(
                    entry.id,
                    crate::source::claude_code_reference(
                        expected["sessionId"].as_str().expect("id"),
                        None
                    )
                );
            }
        }
    }
    let mut ids: Vec<&str> = entries.iter().map(|entry| entry.id.as_str()).collect();
    ids.sort();
    ids.dedup();
    assert_eq!(ids.len(), entries.len(), "references are unique");
}

#[test]
fn catalogue_json_has_no_local_paths() {
    let entries = scan(&claude_only(vec![fixture_root()]));
    let json = serde_json::to_value(entry_for(&entries, "-synthetic-project/simple.jsonl"))
        .expect("listing");
    assert_eq!(json["harness"], "claude-code");
    assert!(json.get("path").is_none());
    assert!(json.get("locator").is_none());
    assert!(json.get("subagentType").is_none());
    assert!(json["id"].as_str().expect("id").starts_with("claude-code-"));
    assert!(!json.to_string().contains("fixtures"));
}

#[test]
fn a_repeated_root_does_not_list_a_transcript_twice() {
    let root = fixture_root();
    let entries = scan(&claude_only(vec![root.clone(), root]));
    assert_eq!(entries.len(), 18);
}

#[test]
fn a_transcript_is_listed_once_it_has_a_response() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let root = fs::canonicalize(directory.path())
        .expect("root")
        .join("projects");
    fs::create_dir_all(root.join("-project")).expect("project");
    let transcript =
        fs::read_to_string("fixtures/claude-code/projects/-synthetic-project/simple.jsonl")
            .expect("fixture");
    let (responses, prompts): (Vec<_>, Vec<_>) = transcript
        .lines()
        .partition(|line| line.contains("\"type\":\"assistant\""));
    assert!(!responses.is_empty());
    let path = root.join("-project/simple.jsonl");
    fs::write(&path, prompts.join("\n") + "\n").expect("prompts");
    let scanner = MixedScanner::new(
        &claude_only(vec![root]),
        Arc::new(watcher::WatchSignals::default()),
    );
    let scan = || {
        scanner
            .scan(Arc::new(AtomicBool::new(false)))
            .expect("scan")
    };
    assert!(scan().is_empty());
    fs::write(&path, transcript).expect("transcript");
    assert_eq!(scan().len(), 1);
}

#[test]
fn a_removed_root_empties_its_entries_and_other_sources_are_kept() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let root = fs::canonicalize(directory.path())
        .expect("root")
        .join("projects");
    fs::create_dir_all(root.join("-project")).expect("project");
    fs::copy(
        "fixtures/claude-code/projects/-synthetic-project/simple.jsonl",
        root.join("-project/simple.jsonl"),
    )
    .expect("copy");
    let mut sources = claude_only(vec![root.clone()]);
    sources.pi_root = Some(fs::canonicalize("fixtures/pi").expect("Pi fixtures"));
    let scanner = MixedScanner::new(&sources, Arc::new(watcher::WatchSignals::default()));
    let first = scanner
        .scan(Arc::new(AtomicBool::new(false)))
        .expect("first");
    assert_eq!(
        first
            .iter()
            .filter(|entry| entry.harness == "claude-code")
            .count(),
        1
    );
    assert!(first.iter().any(|entry| entry.harness == "pi"));
    fs::remove_dir_all(&root).expect("remove root");
    let second = scanner
        .scan(Arc::new(AtomicBool::new(false)))
        .expect("second");
    assert_eq!(
        second
            .iter()
            .filter(|entry| entry.harness == "claude-code")
            .count(),
        0
    );
    assert!(second.iter().any(|entry| entry.harness == "pi"));
}

#[test]
fn claude_code_defaults_follow_the_config_directory_and_explicit_pi_roots() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let home = directory.path().join("home");
    let data = directory.path().join("data");
    let configured = directory.path().join("configured");
    fs::create_dir_all(home.join(".claude/projects")).expect("default root");
    fs::create_dir_all(configured.join("projects")).expect("configured root");
    let canonical = |path: PathBuf| fs::canonicalize(path).expect("canonical");

    let defaults = SourceSet::configured(
        None,
        Vec::new(),
        Vec::new(),
        &home,
        &data,
        None,
        Vec::new(),
        &[],
        Vec::new(),
        None,
    )
    .expect("default Claude Code root");
    assert_eq!(
        defaults.claude_roots,
        vec![canonical(home.join(".claude/projects"))]
    );

    let from_config = SourceSet::configured(
        None,
        Vec::new(),
        Vec::new(),
        &home,
        &data,
        Some(&configured),
        Vec::new(),
        &[],
        Vec::new(),
        None,
    )
    .expect("CLAUDE_CONFIG_DIR root");
    assert_eq!(
        from_config.claude_roots,
        vec![canonical(configured.join("projects"))]
    );

    let pi = fs::canonicalize("fixtures/pi").expect("Pi fixtures");
    let pi_only = SourceSet::configured(
        Some(pi.clone()),
        Vec::new(),
        Vec::new(),
        &home,
        &data,
        None,
        Vec::new(),
        &[],
        Vec::new(),
        None,
    )
    .expect("Pi only");
    assert!(pi_only.claude_roots.is_empty());

    let explicit = SourceSet::configured(
        Some(pi),
        Vec::new(),
        vec![fixture_root()],
        &home,
        &data,
        None,
        Vec::new(),
        &[],
        Vec::new(),
        None,
    )
    .expect("Pi and explicit Claude Code");
    assert_eq!(explicit.claude_roots, vec![fixture_root()]);

    assert!(SourceSet::configured(
        None,
        Vec::new(),
        vec![directory.path().join("missing")],
        &home,
        &data,
        None,
        Vec::new(),
        &[],
        Vec::new(),
        None,
    )
    .is_err());

    let empty_home = directory.path().join("empty-home");
    let error = SourceSet::configured(
        None,
        Vec::new(),
        Vec::new(),
        &empty_home,
        &data,
        None,
        Vec::new(),
        &[],
        Vec::new(),
        None,
    )
    .err()
    .expect("nothing to read");
    assert!(error.to_string().contains("--claude-root"));
}

#[tokio::test]
async fn sessions_are_listed_and_analysed_with_a_coverage_notice() {
    let entries = scan(&claude_only(vec![fixture_root()]));
    let id = entry_for(&entries, "-synthetic-project/simple.jsonl")
        .id
        .clone();
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
    let get = |uri: String| {
        Request::builder()
            .uri(uri)
            .body(Body::empty())
            .expect("request")
    };

    let listing = app
        .clone()
        .oneshot(get("/api/sessions".into()))
        .await
        .expect("listing");
    assert_eq!(listing.status(), StatusCode::OK);
    let json: Value = serde_json::from_slice(
        &to_bytes(listing.into_body(), usize::MAX)
            .await
            .expect("body"),
    )
    .expect("JSON");
    assert!(json.to_string().contains(&id));

    let analysis = app
        .oneshot(get(format!("/api/sessions/{id}/analysis")))
        .await
        .expect("analysis");
    assert_eq!(analysis.status(), StatusCode::OK);
    let json: Value = serde_json::from_slice(
        &to_bytes(analysis.into_body(), usize::MAX)
            .await
            .expect("body"),
    )
    .expect("JSON");
    assert_eq!(json["session"]["source"], "claude-code");
    assert_eq!(json["reconstruction"]["status"], "partial");
    let codes = json["reconstruction"]["explanationCodes"].to_string();
    assert!(codes.contains("missingHistoricalSystemPrompt"));
    assert_eq!(json["modelCalls"].as_array().expect("calls").len(), 1);
}

#[test]
fn claude_code_cache_keys_and_etags_differ_from_pi_keys_for_the_same_file() {
    let path = fixture_root().join("-synthetic-project/simple.jsonl");
    let config = AnalysisConfig {
        tokenization: TokenizationPolicy::Heuristic,
        perf_diagnostics: false,
    };
    let pi = analysis_cache_key(&path, config).expect("Pi key");
    assert_eq!(pi.reader, super::analysis::FileReader::Pi);
    let claude_code = AnalysisCacheKey {
        reader: super::analysis::FileReader::ClaudeCode(FileKind::Main),
        ..pi.clone()
    };
    assert_ne!(etag_for_key(&pi), etag_for_key(&claude_code));
    let subagent = AnalysisCacheKey {
        reader: super::analysis::FileReader::ClaudeCode(FileKind::Subagent),
        ..pi.clone()
    };
    assert_ne!(etag_for_key(&claude_code), etag_for_key(&subagent));
}

#[test]
fn an_agent_tool_result_links_the_subagent_it_started() {
    let entries = scan(&claude_only(vec![fixture_root()]));
    let parent = entry_for(&entries, "-synthetic-project/subagent-parent.jsonl");
    let child = entry_for(
        &entries,
        "-synthetic-project/subagent-parent/subagents/agent-a16.jsonl",
    );
    let loaded =
        crate::source::load(parent.locator.as_ref().expect("locator"), None).expect("parent loads");
    let result = loaded
        .normalized
        .context_items
        .iter()
        .find(|item| item.source_tool_call_id.as_deref() == Some("toolu_s16_agent"))
        .expect("Agent tool result");
    assert_eq!(
        result.metadata.get("childSession"),
        Some(&child.id),
        "the link uses the subagent's catalogue reference"
    );
}
