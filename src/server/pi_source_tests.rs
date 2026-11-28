use super::*;
use sources::{default_pi_roots, MixedScanner, SourceSet};
use std::{collections::HashMap, fs, path::Path};

fn configured(pi_roots: Vec<PathBuf>, pi_defaults: &[PathBuf], home: &Path) -> SourceSet {
    SourceSet::configured(
        pi_roots,
        pi_defaults,
        Vec::new(),
        Vec::new(),
        home,
        &home.join("data"),
        None,
        Vec::new(),
        &[],
        Vec::new(),
        None,
        Vec::new(),
        None,
    )
    .expect("sources")
}

fn scan(sources: &SourceSet) -> Vec<SessionFile> {
    MixedScanner::new(sources, Arc::new(watcher::WatchSignals::default()))
        .scan(Arc::new(AtomicBool::new(false)))
        .expect("discovery")
}

#[test]
fn default_pi_roots_include_pi_and_bb_folders() {
    let home = PathBuf::from("/home/someone");
    assert_eq!(
        default_pi_roots(&home, |_| None),
        vec![
            home.join(".pi/agent/sessions"),
            home.join(".bb/plugins/provider-pi/bridge-data/sessions"),
            home.join(".bb/pi-bridge-sessions"),
        ]
    );
}

#[test]
fn default_pi_roots_follow_the_environment_and_pi_settings() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let home = fs::canonicalize(directory.path()).expect("home");
    let agent = home.join("agent");
    fs::create_dir_all(&agent).expect("agent folder");
    fs::write(agent.join("settings.json"), r#"{"sessionDir":"~/kept"}"#).expect("settings");
    let env = HashMap::from([
        ("PI_CODING_AGENT_SESSION_DIR", home.join("sessions")),
        ("PI_CODING_AGENT_DIR", agent.clone()),
        ("BB_PI_BRIDGE_SESSION_DIR", home.join("bb")),
    ]);
    assert_eq!(
        default_pi_roots(&home, |name| env.get(name).cloned()),
        vec![
            home.join("sessions"),
            home.join("kept"),
            agent.join("sessions"),
            home.join("bb"),
            home.join(".bb/pi-bridge-sessions"),
        ]
    );

    // Relative paths from the environment and settings are not used.
    fs::write(agent.join("settings.json"), r#"{"sessionDir":"relative"}"#).expect("settings");
    let relative = HashMap::from([
        ("PI_CODING_AGENT_SESSION_DIR", PathBuf::from("sessions")),
        ("PI_CODING_AGENT_DIR", agent.clone()),
        ("BB_PI_BRIDGE_SESSION_DIR", PathBuf::from("bb")),
    ]);
    assert_eq!(
        default_pi_roots(&home, |name| relative.get(name).cloned()),
        vec![
            agent.join("sessions"),
            home.join(".bb/plugins/provider-pi/bridge-data/sessions"),
            home.join(".bb/pi-bridge-sessions"),
        ]
    );
}

#[test]
fn existing_default_pi_roots_are_used_until_session_roots_are_given() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let home = fs::canonicalize(directory.path()).expect("home");
    let defaults = default_pi_roots(&home, |_| None);
    let pi = home.join(".pi/agent/sessions");
    let bb = home.join(".bb/plugins/provider-pi/bridge-data/sessions");
    fs::create_dir_all(&pi).expect("Pi folder");
    fs::create_dir_all(&bb).expect("bb folder");

    assert_eq!(
        configured(Vec::new(), &defaults, &home).pi_roots,
        vec![pi.clone(), bb.clone()]
    );
    // Session roots replace the defaults; a repeated root is used once.
    let explicit = home.join("explicit");
    fs::create_dir_all(&explicit).expect("explicit folder");
    assert_eq!(
        configured(
            vec![explicit.clone(), explicit.join("."), bb.clone()],
            &defaults,
            &home
        )
        .pi_roots,
        vec![explicit, bb]
    );
}

#[test]
fn sessions_from_every_pi_root_are_listed_once() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let home = fs::canonicalize(directory.path()).expect("home");
    let first = home.join("first");
    let nested = first.join("project");
    let second = home.join("second");
    fs::create_dir_all(&nested).expect("nested folder");
    fs::create_dir_all(&second).expect("second folder");
    fs::copy("fixtures/pi/simple.jsonl", nested.join("simple.jsonl")).expect("copy");
    fs::copy("fixtures/pi/tools.jsonl", second.join("tools.jsonl")).expect("copy");

    // The nested root finds the first root's file again; it is listed once.
    let sources = configured(vec![first, nested, second], &[], &home);
    let mut names: Vec<_> = scan(&sources)
        .into_iter()
        .map(|session| session.file_name)
        .collect();
    names.sort();
    assert_eq!(names, ["simple.jsonl", "tools.jsonl"]);
}
