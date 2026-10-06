use super::*;

struct TempRoot(PathBuf);
impl TempRoot {
    fn new() -> Self {
        let name = format!(
            "tokenplume-catalog-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos()
        );
        let path = std::env::temp_dir().join(name);
        fs::create_dir(&path).expect("temporary root");
        Self(path)
    }
}
impl Drop for TempRoot {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn recursive_discovery_preserves_canonical_identity_filtering_metadata_and_cancellation() {
    let temp = TempRoot::new();
    let root = canonical_root(&temp.0).expect("canonical root");
    let nested = root.join("nested");
    fs::create_dir(&nested).expect("nested directory");
    let header = "{\"cwd\":\"/tmp/project\",\"timestamp\":\"2026-01-02T03:04:00Z\"}\n";
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
    assert_eq!(session.display_name, "project · Jan 02 03:04 · 12345678");
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
