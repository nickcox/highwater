use super::*;

/// A unique temporary folder, removed when dropped.
struct TempRoot(
    PathBuf,
    // Never read: dropping it removes the folder.
    #[allow(dead_code)] tempfile::TempDir,
);
impl TempRoot {
    fn new() -> Self {
        let directory = tempfile::Builder::new()
            .prefix("highwater-catalog-")
            .tempdir()
            .expect("temporary root");
        Self(directory.path().to_path_buf(), directory)
    }
}

#[test]
fn recursive_discovery_preserves_canonical_identity_filtering_metadata_and_cancellation() {
    let temp = TempRoot::new();
    let root = canonical_root(&temp.0).expect("canonical root");
    let nested = root.join("nested");
    fs::create_dir(&nested).expect("nested directory");
    let header = "{\"cwd\":\"/tmp/project\",\"timestamp\":\"2026-01-02T03:04:00Z\"}\n{\"type\":\"message\",\"message\":{\"role\":\"assistant\"}}\n";
    let session = nested.join("session_123456789.jsonl");
    fs::write(&session, header).expect("nested session");
    fs::write(root.join("other_b.jsonl"), header).expect("root session");
    fs::write(root.join("unfinished.jsonl.tmp"), header).expect("ignored suffix");
    #[cfg(unix)]
    {
        use std::os::unix::fs::symlink;
        symlink(&session, root.join("duplicate.jsonl")).expect("internal symlink");
        symlink(&nested, root.join("directory-alias")).expect("directory symlink");
        symlink(
            fs::canonicalize("fixtures/pi/simple.jsonl").expect("external fixture"),
            root.join("escaped.jsonl"),
        )
        .expect("external symlink");
    }
    let sessions = discover(&root, None).expect("complete discovery");
    assert_eq!(sessions.len(), 2);
    for session in &sessions {
        assert!(session.id.starts_with("pi-"));
        assert_eq!(session.id.len(), 15);
        assert!(session.id[3..].bytes().all(|byte| byte.is_ascii_hexdigit()));
        assert_ne!(session.id, session.path);
        assert!(Path::new(&session.path).starts_with(&root));
    }
    assert!(sessions
        .windows(2)
        .all(|pair| pair[0].modified_nanos >= pair[1].modified_nanos));
    let session = sessions
        .iter()
        .find(|session| session.file_name == "session_123456789.jsonl")
        .expect("nested session metadata");
    assert_eq!(session.display_name, "project · 12345678");
    assert_eq!(session.working_directory.as_deref(), Some("/tmp/project"));
    assert!(session.started_at.is_some());
    let cancelled = AtomicBool::new(true);
    assert!(matches!(
        discover(&root, Some(&cancelled)),
        Err(ScanError::Cancelled)
    ));
    assert!(canonical_root(&root.join("missing")).is_err());
    assert!(canonical_root(&root.join("other_b.jsonl")).is_err());
}

#[test]
fn native_session_references_survive_moves_renames_metadata_changes_and_appends() {
    let first = TempRoot::new();
    let second = TempRoot::new();
    let a = first.0.join("original.jsonl");
    let b = second.0.join("renamed.jsonl");
    fs::write(
        &a,
        "{\"type\":\"session\",\"id\":\"stable-native-id\",\"cwd\":\"/private/one\"}\n",
    )
    .expect("first session");
    fs::write(&b, "{\"type\":\"session\",\"id\":\"stable-native-id\",\"cwd\":\"/different/two\"}\n{\"type\":\"message\"}\n").expect("moved session");
    let original = session_listing_metadata(&a, "original.jsonl").expect("metadata");
    let moved = session_listing_metadata(&b, "renamed.jsonl").expect("metadata");
    assert_eq!(original.reference, moved.reference);
    assert!(original.reference.starts_with("pi-"));
    assert_eq!(original.reference.len(), 15);
    fs::write(&b, "{\"type\":\"session\",\"id\":\"another-native-id\"}\n")
        .expect("different session");
    assert_ne!(
        original.reference,
        session_listing_metadata(&b, "renamed.jsonl")
            .expect("metadata")
            .reference
    );
}

#[test]
fn incomplete_header_references_do_not_include_file_paths() {
    let root = TempRoot::new();
    let path = root.0.join("private-name.jsonl");
    fs::write(&path, "").expect("empty file");
    let metadata = session_listing_metadata(&path, "private-name.jsonl").expect("metadata");
    assert!(metadata.reference.starts_with("pi-"));
    assert_eq!(metadata.reference.len(), 15);
    assert!(!metadata.reference.contains("private"));
}

#[test]
fn pi_listing_reads_typed_prompt_and_caches_by_stamp() {
    let temp = TempRoot::new();
    let root = canonical_root(&temp.0).unwrap();
    let path = root.join("session.jsonl");
    fs::write(&path, concat!(
        "{\"type\":\"session\",\"id\":\"prompt-test\"}\n",
        "{\"type\":\"custom_message\",\"message\":{\"role\":\"user\",\"content\":\"extension context\"}}\n",
        "{\"type\":\"command\",\"message\":{\"role\":\"user\",\"content\":\"command output\"}}\n",
        "{\"type\":\"branch_summary\",\"summary\":\"summary\"}\n",
        "{\"type\":\"message\",\"message\":{\"role\":\"system\",\"content\":\"instructions\"}}\n",
        "{\"type\":\"message\",\"message\":{\"role\":\"user\",\"content\":[{\"type\":\"text\",\"text\":\"  Review\\n the project  \"}]}}\n",
        "{\"type\":\"message\",\"message\":{\"role\":\"user\",\"content\":\"later prompt\"}}\n",
        "{\"type\":\"message\",\"message\":{\"role\":\"assistant\"}}\n"
    )).unwrap();
    let mut cache = PiListingCache::default();
    let list = discover_cached(&root, None, &mut cache).unwrap();
    assert_eq!(list[0].first_prompt.as_deref(), Some("Review the project"));
    assert_eq!(cache.reads, 1);
    discover_cached(&root, None, &mut cache).unwrap();
    assert_eq!(cache.reads, 1);
    fs::write(&path, "{\"type\":\"session\",\"id\":\"prompt-test\"}\n{\"type\":\"message\",\"message\":{\"role\":\"user\",\"content\":\"Changed prompt\"}}\n{\"type\":\"message\",\"message\":{\"role\":\"assistant\"}}\n").unwrap();
    assert_eq!(
        discover_cached(&root, None, &mut cache).unwrap()[0]
            .first_prompt
            .as_deref(),
        Some("Changed prompt")
    );
    assert_eq!(cache.reads, 2);
}

#[test]
fn pi_listing_stops_after_one_mib_without_a_prompt() {
    let temp = TempRoot::new();
    let path = temp.0.join("session.jsonl");
    let mut bytes = b"{\"type\":\"session\",\"id\":\"bounded\"}\n".to_vec();
    // A long system record crosses the budget, including a partial UTF-8 character.
    bytes.extend_from_slice(
        b"{\"type\":\"message\",\"message\":{\"role\":\"system\",\"content\":\"",
    );
    bytes.resize(1024 * 1024 - 1, b' ');
    bytes.extend_from_slice(
        "😀\"}}\n{\"type\":\"message\",\"message\":{\"role\":\"user\",\"content\":\"Too late\"}}\n"
            .as_bytes(),
    );
    fs::write(&path, bytes).unwrap();
    assert!(session_listing_metadata(&path, "session.jsonl")
        .unwrap()
        .first_prompt
        .is_none());
}

#[test]
fn pi_listing_recovers_skill_invocation_and_request() {
    let temp = TempRoot::new();
    let path = temp.0.join("skill.jsonl");
    fs::write(&path, "{\"type\":\"session\",\"id\":\"skill\"}\n{\"type\":\"message\",\"message\":{\"role\":\"user\",\"content\":\"<skill name='review'>instructions</skill> Review this repository\"}}\n").unwrap();
    assert_eq!(
        session_listing_metadata(&path, "skill.jsonl")
            .unwrap()
            .first_prompt
            .as_deref(),
        Some("/skill:review Review this repository")
    );
}

#[test]
fn pi_listing_recovers_skill_only_and_limits_reconstructed_prompt() {
    let temp = TempRoot::new();
    let path = temp.0.join("skill.jsonl");
    let write = |text: &str| {
        let header = serde_json::json!({"type":"session","id":"skill"});
        let message = serde_json::json!({"type":"message","message":{"role":"user","content":[{"type":"text","text":text}]}});
        fs::write(&path, format!("{header}\n{message}\n")).unwrap();
    };
    write(
        r#"<skill name="review-source-refresh-pr" location="/skills/review/SKILL.md">Private instructions</skill>"#,
    );
    assert_eq!(
        session_listing_metadata(&path, "skill.jsonl")
            .unwrap()
            .first_prompt
            .as_deref(),
        Some("/skill:review-source-refresh-pr")
    );
    write(
        r#"<skill name="update-from-sources" location="/skills/update/SKILL.md">Private instructions</skill> for Inventory Optimiser"#,
    );
    assert_eq!(
        session_listing_metadata(&path, "skill.jsonl")
            .unwrap()
            .first_prompt
            .as_deref(),
        Some("/skill:update-from-sources for Inventory Optimiser")
    );
    write(&format!(
        "<skill name=\"review\">instructions</skill> {}",
        "😀".repeat(300)
    ));
    let prompt = session_listing_metadata(&path, "skill.jsonl")
        .unwrap()
        .first_prompt
        .unwrap();
    assert!(prompt.starts_with("/skill:review "));
    assert!(prompt.ends_with('…'));
    assert_eq!(prompt.chars().count(), 301);
    assert!(!prompt.contains("instructions"));
}

#[test]
fn pi_header_after_title_uses_native_identity_and_ignores_title() {
    let temp = TempRoot::new();
    let plain = temp.0.join("session_12345678.jsonl");
    let prefixed = temp.0.join("prefixed_12345678.jsonl");
    let header = "{\"type\":\"session\",\"id\":\"native\",\"cwd\":\"/tmp/project\",\"timestamp\":\"2026-01-02T03:04:00Z\"}\n";
    fs::write(&plain, header).unwrap();
    fs::write(
        &prefixed,
        format!("{{\"type\":\"title\",\"title\":\"Do not use this\",\"pad\":\"    \"}}\n{header}"),
    )
    .unwrap();
    let expected = session_listing_metadata(&plain, "session_12345678.jsonl").unwrap();
    let actual = session_listing_metadata(&prefixed, "prefixed_12345678.jsonl").unwrap();
    assert_eq!(actual.reference, expected.reference);
    assert_eq!(actual.working_directory, expected.working_directory);
    assert_eq!(actual.started_at, expected.started_at);
    assert_eq!(actual.display_name, "project · 12345678");
    // A session header after the first five records is not used for metadata.
    fs::write(
        &prefixed,
        format!("{}{header}", "{\"type\":\"title\"}\n".repeat(5)),
    )
    .unwrap();
    let late = session_listing_metadata(&prefixed, "prefixed_12345678.jsonl").unwrap();
    assert_ne!(late.reference, expected.reference);
    assert!(late.started_at.is_none());
}

#[test]
fn pi_catalogue_waits_for_assistant_and_caches_unlisted_sessions() {
    let temp = TempRoot::new();
    let root = canonical_root(&temp.0).unwrap();
    let path = root.join("session.jsonl");
    let prefix = "{\"type\":\"session\",\"id\":\"waiting\"}\n{\"type\":\"message\",\"message\":{\"role\":\"user\",\"content\":\"Hello\"}}\n";
    fs::write(&path, prefix).unwrap();
    let metadata = session_listing_metadata(&path, "session.jsonl").unwrap();
    assert!(!metadata.has_responses);
    let mut cache = PiListingCache::default();
    assert!(discover_cached(&root, None, &mut cache).unwrap().is_empty());
    assert!(discover_cached(&root, None, &mut cache).unwrap().is_empty());
    assert_eq!(cache.reads, 1);
    fs::write(
        &path,
        format!("{prefix}{{\"type\":\"message\",\"message\":{{\"role\":\"assistant\"}}}}\n"),
    )
    .unwrap();
    let entries = discover_cached(&root, None, &mut cache).unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].id, metadata.reference);
    assert_eq!(entries[0].first_prompt.as_deref(), Some("Hello"));
    assert_eq!(cache.reads, 2);
}

#[test]
fn pi_names_are_latest_nonempty_even_beyond_message_budget() {
    let temp = TempRoot::new();
    let path = temp.0.join("session_12345678.jsonl");
    let mut bytes = b"{\"type\":\"session\",\"id\":\"named\",\"cwd\":\"/tmp/project\"}\n{\"type\":\"message\",\"message\":{\"role\":\"user\",\"content\":\"Hello\"}}\n{\"type\":\"message\",\"message\":{\"role\":\"assistant\"}}\n{\"type\":\"session_info\",\"name\":\"First name\"}\n".to_vec();
    bytes.extend_from_slice(&vec![b' '; 1024 * 1024]);
    bytes.extend_from_slice(b"\n{\"type\" : \"session_info\", \"name\": \"  Latest name  \"}\n{\"type\":\"session_info\",\"name\":\"   \"}\n{\"type\":\"title\",\"title\":\"Ignored\"}\n");
    fs::write(&path, bytes).unwrap();
    let listing = session_listing_metadata(&path, "session_12345678.jsonl").unwrap();
    assert_eq!(listing.display_name, "Latest name");
    assert_eq!(listing.first_prompt.as_deref(), Some("Hello"));
    assert!(listing.has_responses);
    // A late assistant does not bypass the bounded response search.
    fs::write(&path, format!("{{\"type\":\"session\",\"id\":\"late\"}}\n{}\n{{\"type\":\"message\",\"message\":{{\"role\":\"assistant\"}}}}\n{{\"type\":\"session_info\",\"name\":\"Late name\"}}\n", " ".repeat(1024 * 1024))).unwrap();
    let late = session_listing_metadata(&path, "session_12345678.jsonl").unwrap();
    assert!(!late.has_responses);
    assert_eq!(late.display_name, "Late name");
}
