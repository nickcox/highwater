use super::*;
use crate::{
    analysis::{analyze, AnalysisConfig, TokenizationPolicy},
    domain::{
        AssistantContentBlock, ContextItemKind, OutputReasoningRelationship, TokenizationPayload,
    },
    opencode::{
        replay::{reconstruct, ReplayError, ReplayLimitation, ReplayResult},
        storage::Generation,
        usage::OutputAccounting,
    },
};

struct ModernFixture {
    _directory: tempfile::TempDir,
    path: PathBuf,
    writer: Connection,
}
impl ModernFixture {
    fn new() -> Self {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("modern.db");
        let writer = Connection::open(&path).expect("fixture database");
        writer
            .execute_batch(include_str!("../../../fixtures/opencode/modern-schema.sql"))
            .expect("modern schema");
        writer
            .execute_batch(include_str!("../../../fixtures/opencode/modern.sql"))
            .expect("modern records");
        Self {
            _directory: directory,
            path,
            writer,
        }
    }
    fn record(&self, id: &str, seq: i64, kind: &str, data: Value) {
        self.writer
            .execute(
                "INSERT INTO session_message VALUES (?1, 'ses_modern', ?2, ?3, 100, 100, ?4)",
                params![id, kind, seq, data.to_string()],
            )
            .expect("fixture record");
    }
    fn replay(&self) -> Result<ReplayResult, ReplayError> {
        reconstruct(
            load_session(&self.path, "ses_modern", None).expect("modern snapshot"),
            OutputAccounting::Unknown,
        )
    }
    fn update(&self, id: &str, data: Value) {
        self.writer
            .execute(
                "UPDATE session_message SET data = ?1 WHERE id = ?2",
                params![data.to_string(), id],
            )
            .expect("fixture edit");
    }
    fn append_assistant(&self, data: Value) {
        self.record("msg_next", 20, "assistant", data);
    }
}
fn assistant(content: Value) -> Value {
    json!({"model":{"providerID":"openai","id":"gpt-4.1"},"time":{"created":100,"completed":105},"content":content,"tokens":{"input":7,"output":2,"reasoning":0},"cost":0})
}
fn validate(result: &ReplayResult) {
    analyze(
        result.session.clone(),
        AnalysisConfig {
            tokenization: TokenizationPolicy::Auto,
            perf_diagnostics: false,
        },
    )
    .expect("source-neutral analysis contract");
}

#[test]
fn native_sequence_and_inline_payloads_are_preserved_without_private_tables() {
    let f = ModernFixture::new();
    f.writer.execute_batch("CREATE TABLE credential(secret TEXT); INSERT INTO credential VALUES('synthetic-secret'); CREATE TABLE event(data TEXT); INSERT INTO event VALUES('not JSON');").expect("unrelated tables");
    let sessions = discover(&f.path, None).expect("modern discovery");
    assert_eq!(sessions.len(), 1);
    let snapshot = load_session(&f.path, "ses_modern", None).expect("snapshot");
    assert_eq!(snapshot.generation, Generation::Modern);
    assert_eq!(snapshot.messages[1].id, "msg_user");
    assert_eq!(snapshot.messages[1].created_at_ms, 90);
    assert_eq!(snapshot.messages[2].sequence, Some(2));
    assert_eq!(
        snapshot.messages[2].native_kind.as_deref(),
        Some("assistant")
    );
    assert!(snapshot.messages[2].parts.is_empty());
    assert_eq!(snapshot.messages[2].data["content"][0]["type"], "reasoning");
    assert!(!format!("{snapshot:?}").contains("synthetic-secret"));
}

#[test]
fn modern_usage_only_calls_reasoning_tools_and_checkpoint_recent_are_not_lost() {
    let f = ModernFixture::new();
    let r = f.replay().expect("replay");
    validate(&r);
    assert_eq!(r.session.source.version, "sqlite-session-message-v2");
    assert_eq!(r.session.model_calls.len(), 3);
    assert_eq!(r.session.model_calls[1].source_record_id, "msg_empty");
    assert_eq!(r.session.model_calls[1].reported_usage.input, Some(100));
    assert_eq!(r.session.model_calls[0].reported_usage.output, None);
    assert_eq!(r.session.model_calls[0].reported_usage.reasoning, Some(5));
    assert_eq!(r.session.model_calls[0].reported_usage.cache_read, Some(10));
    assert_eq!(
        r.session.model_calls[2].reported_usage.cost.total,
        Some(0.0)
    );
    let output = r
        .session
        .context_items
        .iter()
        .find(|i| {
            i.metadata["sourceMessageId"] == "msg_tool"
                && i.kind == ContextItemKind::AssistantMessage
        })
        .expect("assistant input reused");
    assert!(
        matches!(&output.payload, TokenizationPayload::AssistantMessage { blocks, .. } if blocks.iter().any(|b| matches!(b, AssistantContentBlock::Thinking{text,..} if text == "Synthetic recorded reasoning")))
    );
    assert_eq!(output.metadata["sourceSequence"], "2");
    let tool = r
        .session
        .context_items
        .iter()
        .find(|i| i.kind == ContextItemKind::ToolResult)
        .expect("tool result");
    assert_eq!(tool.source_tool_call_id.as_deref(), Some("call_read"));
    assert_eq!(tool.source_record_id.as_deref(), Some("msg_tool"));
    assert_eq!(r.session.compactions.len(), 1);
    let event = &r.session.compactions[0];
    assert_eq!(event.before_model_call, 3);
    assert_eq!(
        r.session.model_calls[2].compaction_before.as_deref(),
        Some(event.id.as_str())
    );
    assert!(
        event.retained_item_ids.is_empty(),
        "recent is serialized into checkpoint, not original items"
    );
    let summary = r
        .session
        .context_items
        .iter()
        .find(|i| i.id == event.summary_item_id)
        .expect("checkpoint");
    assert!(
        matches!(&summary.payload, TokenizationPayload::CompactionSummary(text) if text.contains("<recent-context>\nSynthetic serialized recent exchange\n</recent-context>"))
    );
    assert_eq!(
        r.session.model_calls[2].context_item_ids,
        vec![summary.id.clone()]
    );
    assert!(r
        .limitations
        .contains(&ReplayLimitation::MissingCompactionUsage));
    assert!(
        r.limitations
            .contains(&ReplayLimitation::MissingHistoricalSystemPrompt),
        "updates aren't a complete system baseline"
    );
}

#[test]
fn native_layout_does_not_infer_migrated_output_accounting_from_creation_version() {
    let f = ModernFixture::new();
    for version in ["1.2.24", "1.4.0", "2.0.20"] {
        f.writer
            .execute("UPDATE session_v2 SET version = ?1", [version])
            .expect("creation version");
        let r = f.replay().expect("replay");
        assert_eq!(r.session.model_calls[0].reported_usage.output, None);
        assert!(r
            .limitations
            .contains(&ReplayLimitation::UnknownOutputAccounting));
    }
    let r = reconstruct(
        load_session(&f.path, "ses_modern", None).expect("snapshot"),
        OutputAccounting::ExcludesReasoning,
    )
    .expect("explicit audited policy");
    assert_eq!(r.session.model_calls[0].reported_usage.output, Some(25));
}

#[test]
fn modern_record_takes_its_accounting_from_the_matching_legacy_step_total() {
    let f = ModernFixture::new();
    f.writer
        .execute_batch(SCHEMA)
        .expect("legacy schema alongside modern");
    f.writer.execute("INSERT INTO session VALUES ('ses_modern', NULL, '/synthetic/legacy', 'Legacy copy', '1.4.0', 1, 100, NULL, NULL)", []).expect("legacy metadata");
    f.writer
        .execute(
            "INSERT INTO message VALUES ('msg_tool', 'ses_modern', 20, 25, '{\"role\":\"assistant\"}')",
            [],
        )
        .expect("legacy copy");
    let step = |id: &str, total: u64, output: u64| {
        f.writer
            .execute(
                "INSERT OR REPLACE INTO part VALUES (?1, 'msg_tool', 'ses_modern', 25, 25, ?2)",
                params![
                    id,
                    json!({"type":"step-finish","tokens":{"total":total,"input":80,"output":output,"reasoning":5,"cache":{"read":10,"write":0}}})
                        .to_string()
                ],
            )
            .expect("legacy step");
    };
    let call = |f: &ModernFixture| {
        let result = f.replay().expect("replay");
        assert_eq!(
            load_session(&f.path, "ses_modern", None)
                .expect("snapshot")
                .generation,
            Generation::Modern
        );
        (
            result.session.model_calls[0].reported_usage.output,
            result.session.model_calls[0]
                .reported_usage
                .output_reasoning_relationship,
            result
                .limitations
                .contains(&ReplayLimitation::UnknownOutputAccounting),
        )
    };
    // 80 + 20 + 5 + 10 = 115: reasoning outside output.
    step("prt_step", 115, 20);
    let before = load_session(&f.path, "ses_modern", None)
        .expect("snapshot")
        .revision;
    assert_eq!(
        call(&f),
        (
            Some(25),
            OutputReasoningRelationship::ExcludesReasoning,
            false
        )
    );
    // 80 + 20 + 10 = 110: reasoning inside output. The evidence is part of the revision.
    step("prt_step", 110, 20);
    assert_ne!(
        load_session(&f.path, "ses_modern", None)
            .expect("snapshot")
            .revision,
        before
    );
    assert_eq!(
        call(&f),
        (
            Some(20),
            OutputReasoningRelationship::IncludesReasoning,
            false
        )
    );
    // Counters that differ from the modern record are not evidence for it.
    step("prt_step", 116, 21);
    assert_eq!(call(&f), (None, OutputReasoningRelationship::Unknown, true));
    // Two steps for one message have no single counterpart.
    step("prt_step", 115, 20);
    step("prt_step_2", 115, 20);
    assert_eq!(call(&f), (None, OutputReasoningRelationship::Unknown, true));
}

#[test]
fn running_and_failed_compactions_do_not_reset_context_and_usage_is_qualified() {
    for status in ["running", "failed"] {
        let f = ModernFixture::new();
        f.update("msg_checkpoint", json!({"status":status,"reason":"auto","tokens":{"input":12,"output":3,"reasoning":0},"cost":0.1,"model":{"providerID":"openai","id":"gpt-4.1"},"time":{"created":50},"error":{"type":"compaction.failed","message":"synthetic failure"}}));
        let r = f.replay().expect("incomplete compaction");
        validate(&r);
        assert!(r.session.compactions.is_empty());
        assert_eq!(r.session.model_calls.len(), 4);
        assert_eq!(
            r.session.model_calls[2].reported_usage.input,
            if status == "running" { None } else { Some(12) }
        );
        assert!(r
            .limitations
            .contains(&ReplayLimitation::AggregatedCompactionUsage));
        assert!(r.session.model_calls[3].context_item_ids.len() > 1);
    }
}

#[test]
fn completed_compaction_usage_is_one_explicit_aggregate_not_double_counted_legacy_usage() {
    let f = ModernFixture::new();
    f.update("msg_checkpoint", json!({"status":"completed","reason":"manual","summary":"synthetic summary","recent":"synthetic tail","tokens":{"input":12,"output":3,"reasoning":0},"cost":0.1,"time":{"created":50}}));
    let r = f.replay().expect("aggregate");
    validate(&r);
    assert_eq!(r.session.model_calls.len(), 4);
    assert_eq!(r.session.model_calls[2].reported_usage.input, Some(12));
    assert_eq!(
        r.session.model_calls[2].context_item_ids.len(),
        1,
        "aggregate inputs are unknown, not a fabricated history window"
    );
    let aggregate_input = r
        .session
        .context_items
        .iter()
        .find(|item| item.id == r.session.model_calls[2].context_item_ids[0])
        .expect("unavailable inputs");
    assert!(matches!(
        aggregate_input.payload,
        TokenizationPayload::Unavailable
    ));
    assert!(
        r.session.model_calls[2].target.model.is_none(),
        "no invented compaction model"
    );
    assert_eq!(
        r.session.model_calls[2].stop_reason.as_deref(),
        Some("compaction-aggregate")
    );
    assert_eq!(r.session.compactions[0].before_model_call, 4);
}

#[test]
fn terminal_checkpoint_has_no_fabricated_usage_exposure_or_lifetime() {
    let f = ModernFixture::new();
    f.record("msg_terminal", 10, "compaction", json!({"status":"completed","reason":"manual","summary":"terminal synthetic","recent":"terminal recent","time":{"created":100}}));
    let r = f.replay().expect("terminal summary");
    validate(&r);
    assert_eq!(r.session.model_calls.len(), 3);
    let event = &r.session.compactions[1];
    let summary = r
        .session
        .context_items
        .iter()
        .find(|i| i.id == event.summary_item_id)
        .expect("terminal structural item");
    assert!(summary.presence.is_empty());
    assert!(summary.lifetime().is_none());
    assert_eq!(event.before_model_call, 4);
}

#[test]
fn failures_and_pending_tools_do_not_become_measured_zero_or_fabricated_results() {
    let f = ModernFixture::new();
    f.record("msg_failed", 10, "assistant", json!({"model":{"providerID":"openai","id":"gpt-4.1"},"content":[],"error":{"type":"provider.failed","message":"synthetic"},"time":{"created":80,"completed":90}}));
    f.record("msg_pending", 11, "assistant", json!({"model":{"providerID":"openai","id":"gpt-4.1"},"content":[{"type":"tool","id":"pending","name":"read","state":{"status":"streaming","input":"{\"path\":\"synthetic\"}"}}],"time":{"created":100},"tokens":{"input":0,"output":0,"reasoning":0},"cost":0}));
    let r = f.replay().expect("incomplete assistants");
    validate(&r);
    for call in &r.session.model_calls[3..] {
        assert!(call.reported_usage.input.is_none());
        assert!(call.reported_usage.cost.total.is_none());
    }
    assert_eq!(r.session.model_calls[4].tool_calls_after[0].id, "pending");
    assert!(!r
        .session
        .context_items
        .iter()
        .any(|i| i.source_tool_call_id.as_deref() == Some("pending")));
}

#[test]
fn malformed_usage_unknown_records_reverts_and_native_checkpoints_fail_closed() {
    for data in [
        json!({"status":"completed","summary":"","recent":"","providerContext":{}}),
        json!({"status":"surprise"}),
    ] {
        let f = ModernFixture::new();
        f.update("msg_checkpoint", data);
        assert!(matches!(f.replay(), Err(ReplayError::UnsupportedHistory)));
    }
    let f = ModernFixture::new();
    let mut data = assistant(json!([]));
    data["tokens"]["input"] = json!(-1);
    f.update("msg_empty", data);
    assert!(matches!(f.replay(), Err(ReplayError::Usage(_))));
    let f = ModernFixture::new();
    f.record(
        "msg_unknown",
        10,
        "future-record",
        json!({"text":"not context"}),
    );
    assert!(matches!(f.replay(), Err(ReplayError::UnsupportedHistory)));
    let f = ModernFixture::new();
    f.writer
        .execute("UPDATE session_v2 SET revert='{}'", [])
        .expect("revert");
    assert!(matches!(f.replay(), Err(ReplayError::UnsupportedHistory)));
}

#[test]
fn native_seq_gaps_are_legal_but_duplicates_negative_and_unsafe_sequences_are_rejected() {
    let f = ModernFixture::new();
    f.record("msg_gap", 100, "idle", json!({}));
    assert!(load_session(&f.path, "ses_modern", None).is_ok());
    for seq in [-1, 2, i64::MAX] {
        let f = ModernFixture::new();
        f.writer
            .execute_batch("DROP INDEX session_message_session_seq_idx")
            .expect("allow corrupt fixture");
        f.record("msg_bad_seq", seq, "idle", json!({}));
        assert!(matches!(
            load_session(&f.path, "ses_modern", None),
            Err(StorageError::InvalidRecords)
        ));
    }
}

#[test]
fn modern_wal_revision_and_budgets_are_snapshot_based() {
    let f = ModernFixture::new();
    f.writer
        .execute_batch("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0")
        .expect("WAL");
    let original = load_session(&f.path, "ses_modern", None).expect("before");
    f.writer.execute_batch("BEGIN; UPDATE session_message SET data=replace(data,'Synthetic modern question','Synthetic modern revision') WHERE id='msg_user'").expect("uncommitted edit");
    assert_eq!(
        load_session(&f.path, "ses_modern", None)
            .expect("snapshot")
            .revision,
        original.revision
    );
    f.writer.execute_batch("COMMIT").expect("commit");
    assert_ne!(
        load_session(&f.path, "ses_modern", None)
            .expect("updated")
            .revision,
        original.revision
    );
    assert!(matches!(
        load_with_budget(&f.path, "ses_modern", 1, usize::MAX),
        Err(StorageError::BudgetExceeded)
    ));
    assert!(matches!(
        load_with_budget(&f.path, "ses_modern", usize::MAX, 1),
        Err(StorageError::BudgetExceeded)
    ));
    let cancelled = Arc::new(AtomicBool::new(true));
    assert!(matches!(
        load_session(&f.path, "ses_modern", Some(cancelled)),
        Err(StorageError::Cancelled)
    ));
}

#[test]
fn mixed_generation_selection_is_consistent_deduplicated_and_never_blends_rows() {
    let f = ModernFixture::new();
    f.writer
        .execute_batch(SCHEMA)
        .expect("legacy schema alongside modern");
    f.writer.execute("INSERT INTO session VALUES ('ses_modern', NULL, '/synthetic/legacy', 'Legacy copy', '1.4.0', 1, 100, NULL, NULL)", []).expect("legacy metadata");
    f.writer
        .execute(
            "INSERT INTO message VALUES ('msg_legacy', 'ses_modern', 1, 1, '{\"role\":\"assistant\"}')",
            [],
        )
        .expect("legacy body");
    assert_eq!(discover(&f.path, None).expect("deduplicated").len(), 1);
    assert_eq!(
        load_session(&f.path, "ses_modern", None)
            .expect("tie")
            .generation,
        Generation::Modern
    );
    f.writer
        .execute("UPDATE session SET time_updated=101", [])
        .expect("legacy newer");
    let snapshot = load_session(&f.path, "ses_modern", None).expect("legacy chosen");
    assert_eq!(snapshot.generation, Generation::Legacy);
    assert_eq!(snapshot.messages.len(), 1);
    assert_eq!(
        discover(&f.path, None).expect("catalog")[0].title,
        "Legacy copy"
    );
    f.writer
        .execute_batch("UPDATE session SET time_updated=100; DELETE FROM session_message;")
        .expect("missing projection");
    assert_eq!(
        load_session(&f.path, "ses_modern", None)
            .expect("tie fallback")
            .generation,
        Generation::Legacy
    );
    f.writer
        .execute("UPDATE session_v2 SET time_updated=102", [])
        .expect("newer v2 empty");
    let snapshot = load_session(&f.path, "ses_modern", None).expect("no resurrection");
    assert_eq!(snapshot.generation, Generation::Modern);
    assert!(snapshot.messages.is_empty());
}

#[test]
fn null_title_and_non_text_attachments_keep_explicit_missingness() {
    let f = ModernFixture::new();
    f.writer
        .execute("UPDATE session_v2 SET title=NULL", [])
        .expect("optional title");
    assert_eq!(
        discover(&f.path, None).expect("list")[0].title,
        "Untitled session"
    );
    f.update("msg_user", json!({"text":"synthetic","files":[{"mime":"text/plain","source":{"type":"uri","uri":"file:///never/read"},"data":"c3ludGhldGlj"}]}));
    let r = f.replay().expect("unknown attachment");
    validate(&r);
    assert!(r
        .limitations
        .contains(&ReplayLimitation::UnsupportedContent));
}

#[test]
fn adjacent_compactions_retain_unobserved_structural_summaries_without_fake_exposure() {
    let f = ModernFixture::new();
    f.writer
        .execute("UPDATE session_message SET seq=seq+10 WHERE seq>=6", [])
        .expect("sequence gap");
    f.record("msg_replacement", 6, "compaction", json!({"status":"completed","reason":"manual","summary":"replacement summary","recent":"replacement recent","time":{"created":56}}));
    let r = f.replay().expect("adjacent checkpoints");
    validate(&r);
    assert_eq!(r.session.compactions.len(), 2);
    assert_eq!(r.session.compactions[0].before_model_call, 3);
    assert_eq!(r.session.compactions[1].before_model_call, 3);
    let first = r
        .session
        .context_items
        .iter()
        .find(|item| {
            item.metadata["sourceMessageId"] == "msg_checkpoint"
                && item.kind == ContextItemKind::CompactionSummary
        })
        .expect("unobserved structural checkpoint");
    assert!(first.presence.is_empty());
    assert!(first.lifetime().is_none());
    assert_eq!(
        r.session.model_calls[2].context_item_ids,
        vec![r
            .session
            .context_items
            .iter()
            .find(|item| item.metadata["sourceMessageId"] == "msg_replacement")
            .expect("replacement")
            .id
            .clone()]
    );
}

#[test]
fn result_identity_survives_inserting_or_settling_an_earlier_pending_tool() {
    let f = ModernFixture::new();
    let original = f
        .replay()
        .expect("replay")
        .session
        .context_items
        .into_iter()
        .find(|item| item.source_tool_call_id.as_deref() == Some("call_read"))
        .expect("result ID")
        .id;
    let snapshot = load_session(&f.path, "ses_modern", None).expect("snapshot");
    let mut data = snapshot.messages[2].data.clone();
    data["content"].as_array_mut().expect("content").insert(
        0,
        json!({"type":"tool","id":"early","name":"read","state":{"status":"running","input":{}}}),
    );
    f.update("msg_tool", data.clone());
    let r = f.replay().expect("pending tool");
    validate(&r);
    assert_eq!(
        r.session
            .context_items
            .iter()
            .find(|item| item.source_tool_call_id.as_deref() == Some("call_read"))
            .expect("same result")
            .id,
        original
    );
    data["content"][0]["state"] =
        json!({"status":"completed","input":{},"content":[{"type":"text","text":"early result"}]});
    f.update("msg_tool", data);
    let r = f.replay().expect("settled tool");
    validate(&r);
    assert_eq!(
        r.session
            .context_items
            .iter()
            .find(|item| item.source_tool_call_id.as_deref() == Some("call_read"))
            .expect("same result")
            .id,
        original
    );
}

#[test]
fn malformed_native_time_and_missing_assistant_content_are_not_silently_normalized() {
    for value in [
        json!(-1.5),
        json!("not a timestamp"),
        json!(i64::MAX),
        Value::Null,
    ] {
        let f = ModernFixture::new();
        let mut data = assistant(json!([]));
        data["time"]["completed"] = value;
        f.update("msg_empty", data);
        assert!(matches!(f.replay(), Err(ReplayError::InvalidRecords)));
    }
    let f = ModernFixture::new();
    f.update("msg_empty", json!({"model":{"providerID":"openai","id":"gpt-4.1"},"time":{"created":30,"completed":35}}));
    assert!(matches!(f.replay(), Err(ReplayError::InvalidRecords)));
}

#[test]
fn native_control_records_do_not_become_invented_context_notes() {
    let f = ModernFixture::new();
    f.record("msg_agent", 10, "agent-switched", json!({"agent":"build"}));
    f.record("msg_model", 11, "model-switched", json!({"model":{"providerID":"openai","id":"gpt-4.1"},"previous":{"providerID":"other","id":"other"}}));
    f.record("msg_idle", 12, "idle", json!({"outcome":"succeeded"}));
    f.record(
        "msg_background",
        13,
        "shell",
        json!({"metadata":{"background":true},"command":"background"}),
    );
    f.record(
        "msg_shell",
        14,
        "shell",
        json!({"command":"synthetic command","output":{"output":"synthetic shell output"}}),
    );
    f.record(
        "msg_skill",
        15,
        "skill",
        json!({"text":"synthetic skill instructions"}),
    );
    f.append_assistant(assistant(json!([])));
    let r = f.replay().expect("control records");
    validate(&r);
    for id in ["msg_agent", "msg_model", "msg_idle", "msg_background"] {
        assert!(!r
            .session
            .context_items
            .iter()
            .any(|item| item.metadata["sourceMessageId"] == id));
    }
    for id in ["msg_shell", "msg_skill"] {
        assert!(r
            .session
            .context_items
            .iter()
            .any(|item| item.metadata["sourceMessageId"] == id
                && item.kind == ContextItemKind::UserMessage));
    }
}

#[test]
fn known_system_update_text_never_claims_a_complete_historical_baseline() {
    let f = ModernFixture::new();
    let r = f.replay().expect("modern replay");
    let analysis = analyze(
        r.session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Auto,
            perf_diagnostics: false,
        },
    )
    .expect("analysis");
    let data = serde_json::to_value(analysis).expect("synthetic DTO");
    assert!(data["modelCalls"][0]["tokenAnalysis"]["explanationCodes"]
        .as_array()
        .expect("diagnostics")
        .contains(&json!("missingSystemPrompt")));
    let update = data["contextItems"]
        .as_array()
        .expect("items")
        .iter()
        .find(|item| item["sourceRecordId"] == "msg_system")
        .expect("frozen update");
    assert_eq!(update["metadata"]["systemUpdateOnly"], "true");
    assert!(
        update["tokenEstimates"][0]["tokens"].is_number(),
        "known logical update text remains estimable"
    );
}

#[test]
fn layout_qualification_changes_digest_even_when_selected_rows_do_not_change() {
    let f = ModernFixture::new();
    let before = load_session(&f.path, "ses_modern", None).expect("modern-only snapshot");
    f.writer
        .execute_batch(SCHEMA)
        .expect("empty legacy generation introduced");
    let after = load_session(&f.path, "ses_modern", None)
        .expect("same modern rows, different qualification");
    assert_eq!(before.messages.len(), after.messages.len());
    assert_eq!(before.generation, after.generation);
    assert!(!before.mixed_layout);
    assert!(after.mixed_layout);
    assert_ne!(
        before.revision, after.revision,
        "cached coverage must be refreshed"
    );
}

#[test]
fn modern_and_experimental_views_are_rejected_without_evaluating_their_bodies() {
    for view in ["session_message", "session_input", "session_context_epoch"] {
        let f = ModernFixture::new();
        if view == "session_message" {
            f.writer
                .execute_batch("ALTER TABLE session_message RENAME TO real_messages")
                .expect("view fixture");
        }
        // This view cannot execute: its backing table is deliberately absent.
        // A typed layout rejection proves capability detection didn't run it.
        f.writer
            .execute_batch(&format!(
                "CREATE VIEW {view} AS SELECT secret FROM missing_credentials"
            ))
            .expect("unsupported view");
        assert!(matches!(
            discover(&f.path, None),
            Err(StorageError::UnsupportedLayout)
        ));
    }
}

#[test]
fn structured_tool_errors_preserve_native_call_identity_and_recorded_content() {
    let f = ModernFixture::new();
    f.update("msg_after", assistant(json!([{"type":"tool","id":"bad_read","name":"read","state":{"status":"error","input":{},"error":{"type":"tool.execution","message":"Synthetic missing file"},"content":[{"type":"text","text":"Synthetic partial output"}]}}])));
    f.append_assistant(assistant(json!([])));
    let r = f.replay().expect("error result");
    validate(&r);
    let tool = r
        .session
        .context_items
        .iter()
        .find(|i| i.source_tool_call_id.as_deref() == Some("bad_read"))
        .expect("result");
    assert!(
        matches!(&tool.payload, TokenizationPayload::ToolResult {is_error:true,content,..} if content.parts.len() == 2)
    );
}

#[test]
fn modern_task_result_links_the_child_session_it_started() {
    let f = ModernFixture::new();
    f.update("msg_after", assistant(json!([{"type":"tool","id":"call_task","name":"task","state":{"status":"completed","input":{"description":"Explore"},"metadata":{"parentSessionId":"ses_modern","sessionId":"ses_child"},"content":[{"type":"text","text":"Findings"}]}}])));
    f.append_assistant(assistant(json!([])));
    let r = f.replay().expect("replay");
    validate(&r);
    let task = r
        .session
        .context_items
        .iter()
        .find(|i| i.source_tool_call_id.as_deref() == Some("call_task"))
        .expect("task result");
    assert_eq!(
        task.metadata.get("childSession"),
        Some(&crate::source::opencode_reference("ses_child"))
    );
}
