use super::*;
use crate::source::{codex_reference, SessionLocator};
use sources::{MixedScanner, SourceSet};
use std::{fs, path::Path};

fn home() -> PathBuf {
    fs::canonicalize("fixtures/codex/home").expect("fixture home")
}

fn codex_only(homes: Vec<PathBuf>) -> SourceSet {
    SourceSet {
        pi_root: None,
        databases: Vec::new(),
        claude_roots: Vec::new(),
        vscode_user_dirs: Vec::new(),
        codex_homes: homes,
    }
}

fn scan(sources: &SourceSet) -> Vec<SessionFile> {
    MixedScanner::new(sources, Arc::new(watcher::WatchSignals::default()))
        .scan(Arc::new(AtomicBool::new(false)))
        .expect("discovery")
}

fn reference(number: &str) -> String {
    codex_reference(&format!("01a10000-0000-7000-8000-000000000{number}"))
}

fn entry<'a>(entries: &'a [SessionFile], number: &str) -> &'a SessionFile {
    let id = reference(number);
    entries
        .iter()
        .find(|entry| entry.id == id)
        .unwrap_or_else(|| panic!("session {number} is not listed"))
}

#[test]
fn catalogue_lists_codex_sessions_with_titles_and_child_sessions() {
    let entries = scan(&codex_only(vec![home()]));
    let mut ids: Vec<&str> = entries.iter().map(|entry| entry.id.as_str()).collect();
    ids.sort_unstable();
    let mut expected: Vec<String> = ["001", "002", "003", "004", "006", "007"]
        .iter()
        .map(|number| reference(number))
        .chain([codex_reference("01a30000-0000-7000-8000-000000000008")])
        .collect();
    expected.sort_unstable();
    assert_eq!(ids, expected, "the session without usage is not listed");
    assert!(entries.iter().all(|entry| entry.harness == "codex"));

    let main = entry(&entries, "001");
    assert_eq!(main.display_name, "Synthetic Codex task");
    assert_eq!(
        main.working_directory.as_deref(),
        Some("/synthetic/project")
    );
    assert!(main.started_at.is_some());
    assert_eq!(main.parent_reference, None);
    assert!(matches!(
        &main.locator,
        Some(SessionLocator::CodexFile { path }) if path.starts_with(home())
    ));
    assert_eq!(entry(&entries, "002").display_name, "other · 01a10000");
    assert_eq!(entry(&entries, "006").display_name, "Archived work");

    let guardian = entry(&entries, "003");
    assert_eq!(guardian.display_name, "Guardian review");
    assert_eq!(guardian.parent_reference, Some(reference("001")));
    assert_eq!(guardian.subagent_type.as_deref(), Some("guardian"));
    let spawned = entry(&entries, "004");
    assert_eq!(spawned.display_name, "Hopper");
    assert_eq!(spawned.parent_reference, Some(reference("001")));
    assert_eq!(spawned.subagent_type.as_deref(), Some("code_review"));

    let json = serde_json::to_value(main).expect("listing");
    assert!(json.get("path").is_none());
    assert!(json.get("locator").is_none());
    assert!(!json.to_string().contains("fixtures"));
}

#[test]
fn a_thread_found_twice_is_listed_once() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let copy = fs::canonicalize(directory.path())
        .expect("home")
        .join("codex");
    let day = copy.join("sessions/2026/10/01");
    fs::create_dir_all(&day).expect("sessions");
    fs::create_dir_all(copy.join("archived_sessions")).expect("archive");
    let name = "rollout-2026-10-01T10-00-00-01a10000-0000-7000-8000-000000000001.jsonl";
    let source = home().join("sessions/2026/10/01").join(name);
    fs::copy(&source, day.join(name)).expect("session");
    fs::copy(&source, copy.join("archived_sessions").join(name)).expect("archived copy");

    let entries = scan(&codex_only(vec![copy.clone(), copy]));
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].id, reference("001"));
}

#[test]
fn codex_home_comes_from_the_flag_then_codex_home_then_the_home_folder() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let home_folder = fs::canonicalize(directory.path()).expect("home");
    let data = home_folder.join("data");
    let configured = |homes: Vec<PathBuf>, env: Option<&Path>, pi: Option<PathBuf>| {
        SourceSet::configured(
            pi,
            Vec::new(),
            Vec::new(),
            &home_folder,
            &data,
            None,
            Vec::new(),
            &[],
            homes,
            env,
        )
    };

    assert!(
        configured(Vec::new(), None, None).is_err(),
        "no ~/.codex and nothing else configured"
    );
    let default = home_folder.join(".codex");
    fs::create_dir_all(&default).expect("default home");
    assert_eq!(
        configured(Vec::new(), None, None)
            .expect("~/.codex")
            .codex_homes,
        vec![default.clone()]
    );
    let from_env = home_folder.join("elsewhere");
    fs::create_dir_all(&from_env).expect("CODEX_HOME");
    assert_eq!(
        configured(Vec::new(), Some(&from_env), None)
            .expect("CODEX_HOME")
            .codex_homes,
        vec![from_env]
    );
    assert_eq!(
        configured(vec![home(), home()], None, None)
            .expect("explicit")
            .codex_homes,
        vec![home()]
    );
    let pi = home_folder.join("pi");
    fs::create_dir_all(&pi).expect("Pi root");
    assert!(configured(Vec::new(), None, Some(pi))
        .expect("Pi only")
        .codex_homes
        .is_empty());
}
