use super::storage::{discover, load_session, load_with_budget, StorageError};
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

mod modern;
mod replay;

const SCHEMA: &str = include_str!("../../fixtures/opencode/legacy-schema.sql");

struct Fixture {
    _directory: tempfile::TempDir,
    path: PathBuf,
    writer: Connection,
}

impl Fixture {
    fn new(modern: bool) -> Self {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("synthetic opencode.db");
        let writer = Connection::open(&path).expect("create synthetic database");
        writer.execute_batch(SCHEMA).expect("synthetic schema");
        if modern {
            writer
                .execute_batch(
                    "
                ALTER TABLE session ADD COLUMN tokens_input INTEGER NOT NULL DEFAULT 0;
                ALTER TABLE session ADD COLUMN metadata TEXT;
                CREATE TABLE session_message (id TEXT PRIMARY KEY, session_id TEXT, data TEXT);
                CREATE TABLE session_context_epoch (session_id TEXT PRIMARY KEY, baseline TEXT);
                CREATE TABLE session_input (id TEXT PRIMARY KEY, session_id TEXT, prompt TEXT);
                CREATE TABLE credential (value TEXT);
            ",
                )
                .expect("additive modern schema");
        }
        let result = Self {
            _directory: directory,
            path,
            writer,
        };
        result.session("ses_example", None, 100);
        result
    }

    fn session(&self, id: &str, parent: Option<&str>, updated: i64) {
        self.writer.execute("INSERT INTO session (id, parent_id, directory, title, version, time_created, time_updated) VALUES (?1, ?2, '/synthetic/project', 'Synthetic task', '1.4.0', 10, ?3)", params![id, parent, updated]).expect("insert synthetic session");
    }

    fn message(&self, session: &str, id: &str, created: i64, data: Value) {
        self.writer
            .execute(
                "INSERT INTO message VALUES (?1, ?2, ?3, ?3, ?4)",
                params![id, session, created, data.to_string()],
            )
            .expect("insert synthetic message");
    }

    fn part(&self, session: &str, message: &str, id: &str, created: i64, data: Value) {
        self.writer
            .execute(
                "INSERT INTO part VALUES (?1, ?2, ?3, ?4, ?4, ?5)",
                params![id, message, session, created, data.to_string()],
            )
            .expect("insert synthetic part");
    }

    fn wal(&self) {
        self.writer
            .execute_batch("PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0;")
            .expect("WAL fixture");
    }
}

#[test]
fn both_layouts_discover_without_reading_unrelated_tables() {
    for modern in [false, true] {
        let fixture = Fixture::new(modern);
        fixture.session("ses_child", Some("ses_example"), 200);
        fixture.session("ses_empty", None, 300);
        for session in ["ses_example", "ses_child"] {
            fixture.message(
                session,
                &format!("msg_{session}"),
                1,
                json!({"role": "assistant"}),
            );
        }
        if modern {
            fixture
                .writer
                .execute("INSERT INTO credential VALUES ('synthetic-secret')", [])
                .expect("credential fixture");
        }
        let sessions = discover(&fixture.path, None).expect("discover");
        assert_eq!(sessions.len(), 2);
        assert_eq!(sessions[0].id, "ses_child");
        assert_eq!(sessions[0].parent_id.as_deref(), Some("ses_example"));
        assert_eq!(sessions[1].directory, "/synthetic/project");
        assert!(!format!("{sessions:?}").contains("synthetic-secret"));
        // A session with no response is not listed, but still loads.
        assert!(load_session(&fixture.path, "ses_empty", None)
            .expect("empty session")
            .messages
            .is_empty());
    }
}

#[test]
fn message_time_and_id_order_and_part_id_order_are_preserved() {
    let fixture = Fixture::new(false);
    fixture.message("ses_example", "msg_z", 10, json!({"role":"user"}));
    fixture.message("ses_example", "msg_b", 20, json!({"role":"assistant"}));
    fixture.message("ses_example", "msg_a", 20, json!({"role":"assistant"}));
    fixture.part(
        "ses_example",
        "msg_a",
        "prt_z",
        1,
        json!({"type":"text","text":"last"}),
    );
    fixture.part(
        "ses_example",
        "msg_a",
        "prt_a",
        99,
        json!({"type":"text","text":"first"}),
    );
    let snapshot = load_session(&fixture.path, "ses_example", None).expect("snapshot");
    assert_eq!(
        snapshot
            .messages
            .iter()
            .map(|m| m.id.as_str())
            .collect::<Vec<_>>(),
        ["msg_z", "msg_a", "msg_b"]
    );
    let message = &snapshot.messages[1];
    assert_eq!((message.created_at_ms, message.updated_at_ms), (20, 20));
    assert_eq!(message.data["role"], "assistant");
    assert_eq!(
        message
            .parts
            .iter()
            .map(|p| p.id.as_str())
            .collect::<Vec<_>>(),
        ["prt_a", "prt_z"]
    );
    assert_eq!(
        (
            message.parts[0].created_at_ms,
            message.parts[0].updated_at_ms
        ),
        (99, 99)
    );
    assert_eq!(message.parts[0].data["text"], "first");
    assert!(snapshot.source_bytes > 0);
    assert_eq!(snapshot.metadata.id, "ses_example");
}

#[test]
fn native_ids_are_bound_parameters_and_sessions_are_isolated() {
    let fixture = Fixture::new(false);
    let injected = "ses_' OR 1=1 --";
    fixture.session(injected, None, 100);
    fixture.message(injected, "msg_other", 20, json!({"role":"user"}));
    fixture.message("ses_example", "msg_one", 20, json!({"role":"user"}));
    fixture.part(
        injected,
        "msg_other",
        "prt_other",
        30,
        json!({"type":"text","text":"other"}),
    );
    let snapshot = load_session(&fixture.path, injected, None).expect("bound ID");
    assert_eq!(snapshot.messages.len(), 1);
    assert_eq!(snapshot.messages[0].id, "msg_other");
    assert!(matches!(
        load_session(&fixture.path, "missing", None),
        Err(StorageError::NotFound)
    ));
}

#[test]
fn orphan_and_cross_session_parts_are_rejected() {
    for (session, message) in [
        ("ses_example", "missing"),
        ("ses_other", "msg_one"),
        ("ses_example", "msg_other"),
    ] {
        let fixture = Fixture::new(false);
        fixture.session("ses_other", None, 100);
        fixture.message("ses_example", "msg_one", 20, json!({"role":"user"}));
        fixture.message("ses_other", "msg_other", 20, json!({"role":"user"}));
        fixture.part(session, message, "prt_one", 30, json!({"type":"text"}));
        assert!(matches!(
            load_session(&fixture.path, "ses_example", None),
            Err(StorageError::InvalidRecords)
        ));
    }
}

#[test]
fn invalid_json_or_non_object_payloads_do_not_become_empty_histories() {
    for table in ["message", "part"] {
        for bad in ["{", "[]", "null", "42", "\"synthetic-private-text\""] {
            let fixture = Fixture::new(false);
            fixture.message("ses_example", "msg_one", 20, json!({"role":"user"}));
            fixture.part(
                "ses_example",
                "msg_one",
                "prt_one",
                30,
                json!({"type":"text"}),
            );
            fixture
                .writer
                .execute(&format!("UPDATE {table} SET data = ?1"), [bad])
                .expect("invalid payload");
            let error = load_session(&fixture.path, "ses_example", None)
                .expect_err("reject invalid payload");
            assert!(matches!(error, StorageError::InvalidRecords));
            assert!(!error.to_string().contains("synthetic-private-text"));
        }
    }
}

#[test]
fn same_size_same_timestamp_payload_edits_change_revision() {
    let fixture = Fixture::new(false);
    fixture.message("ses_example", "msg_one", 20, json!({"role":"user"}));
    fixture.part(
        "ses_example",
        "msg_one",
        "prt_one",
        30,
        json!({"type":"text","text":"aaa"}),
    );
    let before = load_session(&fixture.path, "ses_example", None).expect("before");
    fixture
        .writer
        .execute(
            "UPDATE part SET data = ?1",
            [json!({"type":"text","text":"bbb"}).to_string()],
        )
        .expect("same-size edit");
    let after = load_session(&fixture.path, "ses_example", None).expect("after");
    assert_eq!(before.source_bytes, after.source_bytes);
    assert_ne!(before.revision, after.revision);
    assert_eq!(
        after.revision,
        load_session(&fixture.path, "ses_example", None)
            .expect("stable repeat")
            .revision
    );
}

#[test]
fn metadata_and_row_timestamps_participate_in_revision() {
    let fixture = Fixture::new(false);
    fixture.message("ses_example", "msg_one", 20, json!({"role":"user"}));
    fixture.part(
        "ses_example",
        "msg_one",
        "prt_one",
        30,
        json!({"type":"text"}),
    );
    let mut previous = load_session(&fixture.path, "ses_example", None)
        .expect("snapshot")
        .revision;
    for sql in [
        "UPDATE session SET title = 'Changed task'",
        "UPDATE session SET parent_id = 'ses_parent'",
        "UPDATE session SET time_archived = 200",
        "UPDATE session SET revert = '{\"messageID\":\"msg_one\"}'",
        "UPDATE message SET time_updated = 40",
        "UPDATE part SET time_updated = 50",
    ] {
        fixture.writer.execute(sql, []).expect("edit");
        let next = load_session(&fixture.path, "ses_example", None)
            .expect("snapshot")
            .revision;
        assert_ne!(previous, next, "{sql}");
        previous = next;
    }
}

#[test]
fn unrelated_session_and_unknown_optional_fields_do_not_change_revision() {
    let fixture = Fixture::new(true);
    let before = load_session(&fixture.path, "ses_example", None)
        .expect("snapshot")
        .revision;
    fixture.session("ses_other", None, 300);
    fixture.message("ses_other", "msg_other", 300, json!({"role":"user"}));
    fixture
        .writer
        .execute(
            "UPDATE session SET metadata = 'unrelated', tokens_input = 99 WHERE id = 'ses_example'",
            [],
        )
        .expect("optional metadata");
    assert_eq!(
        before,
        load_session(&fixture.path, "ses_example", None)
            .expect("snapshot")
            .revision
    );
}

#[test]
fn wal_only_commits_are_seen_without_mutating_or_checkpointing_the_database() {
    let fixture = Fixture::new(false);
    fixture.wal();
    fixture.message("ses_example", "msg_one", 20, json!({"role":"user"}));
    fixture.part(
        "ses_example",
        "msg_one",
        "prt_one",
        30,
        json!({"type":"text","text":"before"}),
    );
    fixture
        .writer
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE)")
        .expect("initial fixture checkpoint");
    let main_before = std::fs::read(&fixture.path).expect("main file");
    let before = load_session(&fixture.path, "ses_example", None).expect("before");
    fixture
        .writer
        .execute(
            "UPDATE part SET data = ?1",
            [json!({"type":"text","text":"after"}).to_string()],
        )
        .expect("WAL edit");
    assert_eq!(
        main_before,
        std::fs::read(&fixture.path).expect("main file unchanged")
    );
    let wal_path = fixture.path.with_file_name("synthetic opencode.db-wal");
    let wal_before_read = std::fs::read(&wal_path).expect("WAL file");
    let after = load_session(&fixture.path, "ses_example", None).expect("WAL snapshot");
    assert_ne!(before.revision, after.revision);
    assert_eq!(after.messages[0].parts[0].data["text"], "after");
    assert_eq!(
        main_before,
        std::fs::read(&fixture.path).expect("no checkpoint")
    );
    assert_eq!(
        wal_before_read,
        std::fs::read(wal_path).expect("no WAL writes")
    );
}

#[test]
fn uncommitted_writes_do_not_enter_snapshot() {
    let fixture = Fixture::new(false);
    fixture.wal();
    let before = load_session(&fixture.path, "ses_example", None)
        .expect("snapshot")
        .revision;
    fixture
        .writer
        .execute_batch("BEGIN IMMEDIATE; UPDATE session SET title = 'Not committed';")
        .expect("uncommitted edit");
    let during = load_session(&fixture.path, "ses_example", None).expect("committed snapshot");
    assert_eq!(before, during.revision);
    assert_eq!(during.metadata.title, "Synthetic task");
    fixture.writer.execute_batch("ROLLBACK").expect("rollback");
}

#[test]
fn concurrent_commits_cannot_mix_message_and_part_generations() {
    let fixture = Fixture::new(false);
    fixture.wal();
    fixture.message("ses_example", "msg_one", 20, json!({"generation":0}));
    fixture.part(
        "ses_example",
        "msg_one",
        "prt_one",
        30,
        json!({"generation":0}),
    );
    std::thread::scope(|scope| {
        let path = fixture.path.clone();
        let writer = scope.spawn(move || {
            let mut writer = Connection::open(path).expect("concurrent writer");
            for generation in 1..=50 {
                let tx = writer.transaction().expect("write transaction");
                let data = json!({"generation":generation}).to_string();
                tx.execute("UPDATE message SET data = ?1", [&data])
                    .expect("message update");
                tx.execute("UPDATE part SET data = ?1", [&data])
                    .expect("part update");
                tx.commit().expect("commit");
            }
        });
        for _ in 0..50 {
            let snapshot =
                load_session(&fixture.path, "ses_example", None).expect("concurrent snapshot");
            assert_eq!(
                snapshot.messages[0].data["generation"],
                snapshot.messages[0].parts[0].data["generation"]
            );
        }
        writer.join().expect("writer joined");
    });
}

#[test]
fn database_replacement_is_seen_on_the_next_read() {
    let fixture = Fixture::new(false);
    let before = load_session(&fixture.path, "ses_example", None)
        .expect("old database")
        .revision;
    let replacement = Fixture::new(false);
    replacement
        .writer
        .execute("UPDATE session SET title = 'Replacement'", [])
        .expect("replacement data");
    drop(replacement.writer);
    std::fs::rename(&replacement.path, &fixture.path).expect("replace database");
    let next = load_session(&fixture.path, "ses_example", None).expect("replacement database");
    assert_ne!(before, next.revision);
    assert_eq!(next.metadata.title, "Replacement");
}

#[test]
fn missing_database_is_not_created() {
    let directory = tempfile::tempdir().expect("tempdir");
    let path = directory.path().join("missing.db");
    assert!(matches!(
        discover(&path, None),
        Err(StorageError::Database(_))
    ));
    assert!(!path.exists());
}

#[test]
fn corrupt_database_has_a_typed_privacy_safe_error() {
    let directory = tempfile::tempdir().expect("tempdir");
    let path = directory.path().join("bad.db");
    std::fs::write(&path, b"synthetic-private-data-not-a-database").expect("bad fixture");
    let error = discover(&path, None).expect_err("corrupt database");
    assert!(matches!(error, StorageError::Corrupt));
    assert!(!error.to_string().contains("synthetic-private"));
}

#[test]
fn unsupported_columns_or_views_are_rejected() {
    for sql in [
        "ALTER TABLE message RENAME COLUMN data TO payload",
        "DROP TABLE part",
        "ALTER TABLE part RENAME TO old_part; CREATE VIEW part AS SELECT * FROM old_part",
    ] {
        let fixture = Fixture::new(false);
        fixture
            .writer
            .execute_batch(sql)
            .expect("unsupported schema");
        assert!(matches!(
            discover(&fixture.path, None),
            Err(StorageError::UnsupportedLayout)
        ));
    }
}

#[test]
fn populated_modern_storage_is_not_silently_read_as_legacy_history() {
    for table in ["session_message", "session_context_epoch", "session_input"] {
        let fixture = Fixture::new(true);
        fixture
            .writer
            .execute(
                &format!("INSERT INTO {table} (session_id) VALUES ('ses_example')"),
                [],
            )
            .expect("modern row");
        assert!(matches!(
            discover(&fixture.path, None),
            Err(StorageError::UnsupportedLayout)
        ));
        assert!(matches!(
            load_session(&fixture.path, "ses_example", None),
            Err(StorageError::UnsupportedLayout)
        ));
    }
}

#[test]
fn safe_integer_timestamp_and_metadata_validation_are_enforced() {
    for sql in [
        "UPDATE session SET time_created = 9007199254740992",
        "UPDATE session SET time_updated = -9007199254740992",
        "UPDATE session SET time_archived = 9007199254740992",
        "UPDATE session SET id = ''",
        "UPDATE session SET version = ''",
        "UPDATE session SET parent_id = ''",
        "UPDATE session SET revert = '[]'",
    ] {
        let fixture = Fixture::new(false);
        fixture.writer.execute(sql, []).expect("invalid metadata");
        assert!(
            matches!(
                discover(&fixture.path, None),
                Err(StorageError::InvalidRecords)
            ),
            "{sql}"
        );
    }
    for table in ["message", "part"] {
        let fixture = Fixture::new(false);
        fixture.message("ses_example", "msg_one", 20, json!({}));
        fixture.part("ses_example", "msg_one", "prt_one", 30, json!({}));
        fixture
            .writer
            .execute(
                &format!("UPDATE {table} SET time_created = 9007199254740992"),
                [],
            )
            .expect("unsafe time");
        assert!(matches!(
            load_session(&fixture.path, "ses_example", None),
            Err(StorageError::InvalidRecords)
        ));
    }
}

#[test]
fn budgets_reject_rows_and_bytes_explicitly() {
    let fixture = Fixture::new(false);
    fixture.message("ses_example", "msg_one", 20, json!({"role":"user"}));
    fixture.part(
        "ses_example",
        "msg_one",
        "prt_one",
        30,
        json!({"type":"text"}),
    );
    assert!(matches!(
        load_with_budget(&fixture.path, "ses_example", 1, 4096),
        Err(StorageError::BudgetExceeded)
    ));
    assert!(matches!(
        load_with_budget(&fixture.path, "ses_example", 10, 1),
        Err(StorageError::BudgetExceeded)
    ));
    assert!(load_with_budget(&fixture.path, "ses_example", 2, 4096).is_ok());
}

#[test]
fn cancelled_reads_return_a_distinct_error() {
    let fixture = Fixture::new(false);
    let signal = Arc::new(AtomicBool::new(true));
    assert!(matches!(
        discover(&fixture.path, Some(Arc::clone(&signal))),
        Err(StorageError::Cancelled)
    ));
    assert!(matches!(
        load_session(&fixture.path, "ses_example", Some(Arc::clone(&signal))),
        Err(StorageError::Cancelled)
    ));
    signal.store(false, Ordering::Release);
    assert!(discover(&fixture.path, Some(signal)).is_ok());
}

#[test]
fn exclusive_writer_lock_returns_busy_and_recovers() {
    let fixture = Fixture::new(false);
    fixture
        .writer
        .execute_batch("BEGIN EXCLUSIVE")
        .expect("exclusive lock");
    assert!(matches!(
        discover(&fixture.path, None),
        Err(StorageError::Busy)
    ));
    fixture.writer.execute_batch("ROLLBACK").expect("unlock");
    assert!(discover(&fixture.path, None).is_ok());
}

/// Opt-in local acceptance only. Never commits a database or prints identifiers,
/// paths, transcript text, arguments, results, or account/credential data.
#[test]
#[ignore = "requires HIGHWATER_OPENCODE_DB pointing to a local database"]
fn local_database_read_only_inventory() {
    use crate::analysis::{AnalysisConfig, TokenizationPolicy};
    use crate::opencode::{
        replay::{reconstruct, ReplayError},
        usage::OutputAccounting,
    };
    let path =
        PathBuf::from(std::env::var_os("HIGHWATER_OPENCODE_DB").expect("explicit database path"));
    let started = std::time::Instant::now();
    let sessions = discover(&path, None).expect("read-only discovery");
    let discovery_ms = started.elapsed().as_secs_f64() * 1000.0;
    let mut load_ms = Vec::new();
    let mut largest: Option<(String, usize)> = None;
    let mut loaded = 0;
    let mut replayed = 0;
    let mut unsupported = 0;
    let mut invalid = 0;
    let mut calls = 0;
    let mut budget_rejected = 0;
    for session in &sessions {
        let loading = std::time::Instant::now();
        let snapshot = match load_session(&path, &session.id, None) {
            Ok(snapshot) => snapshot,
            Err(StorageError::BudgetExceeded) => {
                budget_rejected += 1;
                continue;
            }
            Err(_) => {
                invalid += 1;
                continue;
            }
        };
        load_ms.push(loading.elapsed().as_secs_f64() * 1000.0);
        if largest
            .as_ref()
            .is_none_or(|(_, bytes)| snapshot.source_bytes > *bytes)
        {
            largest = Some((session.id.clone(), snapshot.source_bytes));
        }
        loaded += 1;
        match reconstruct(snapshot, OutputAccounting::Unknown) {
            Ok(result) => {
                calls += result.session.model_calls.len();
                let analysis = crate::source::analyze_reconstructed(
                    result,
                    AnalysisConfig {
                        tokenization: TokenizationPolicy::Off,
                        perf_diagnostics: false,
                    },
                )
                .expect("domain/API invariants");
                assert_eq!(
                    analysis.reconstruction.as_ref().map(|report| report.status),
                    Some("partial")
                );
                replayed += 1;
            }
            Err(ReplayError::UnsupportedHistory) => unsupported += 1,
            Err(_) => invalid += 1,
        }
    }
    println!("opencode_inventory sessions={} loaded={loaded} replayed={replayed} unsupported={unsupported} invalid={invalid} budget_rejected={budget_rejected} calls={calls} elapsed_ms={}", sessions.len(), started.elapsed().as_millis());
    assert!(replayed > 0, "at least one locally reconstructable session");
    load_ms.sort_by(f64::total_cmp);
    let (largest_id, largest_bytes) = largest.expect("loaded source");
    let mut repeated_ms = Vec::new();
    for _ in 0..5 {
        let loading = std::time::Instant::now();
        let snapshot = load_session(&path, &largest_id, None).expect("repeat read-only snapshot");
        repeated_ms.push(loading.elapsed().as_secs_f64() * 1000.0);
        std::hint::black_box(snapshot);
    }
    repeated_ms.sort_by(f64::total_cmp);
    println!("opencode_snapshot_benchmark discovery_ms={discovery_ms:.3} initial_load_p50_ms={:.3} initial_load_max_ms={:.3} largest_source_bytes={largest_bytes} largest_repeat_p50_ms={:.3}", load_ms[load_ms.len() / 2], load_ms.last().expect("loaded source"), repeated_ms[2]);
}
