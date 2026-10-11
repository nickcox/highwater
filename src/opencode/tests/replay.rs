use super::Fixture;
use crate::{
    analysis::{analyze, AnalysisConfig, TokenizationPolicy},
    domain::{
        ContextItemKind, NormalizedSession, OutputReasoningRelationship, TokenizationPayload,
    },
    opencode::{
        replay::{reconstruct, ReplayError, ReplayLimitation, ReplayResult},
        storage::load_session,
        usage::OutputAccounting,
    },
};
use serde_json::{json, Value};

impl Fixture {
    fn user(&self, id: &str, at: i64, content: Value) {
        self.message(
            "ses_example",
            id,
            at,
            json!({"role":"user","time":{"created":at}}),
        );
        self.part("ses_example", id, &format!("{id}_part"), at, content);
    }

    fn assistant(&self, id: &str, parent: &str, at: i64, summary: bool) {
        let tokens = json!({"input":80,"output":20,"reasoning":10,"cache":{"read":20,"write":0},"total":130});
        self.message("ses_example", id, at, json!({"role":"assistant","parentID":parent,"providerID":"synthetic-provider","modelID":"synthetic-model","time":{"created":at,"completed":at+5},"finish":"stop","summary":summary,"tokens":tokens,"cost":0.25}));
        self.part(
            "ses_example",
            id,
            &format!("{id}_0_start"),
            at,
            json!({"type":"step-start"}),
        );
        self.part(
            "ses_example",
            id,
            &format!("{id}_9_finish"),
            at + 5,
            json!({"type":"step-finish","reason":"stop","tokens":tokens,"cost":0.25}),
        );
    }

    fn text(&self, id: &str, content: &str) {
        self.part(
            "ses_example",
            id,
            &format!("{id}_1_text"),
            1,
            json!({"type":"text","text":content}),
        );
    }

    fn replay(&self) -> Result<ReplayResult, ReplayError> {
        reconstruct(
            load_session(&self.path, "ses_example", None).expect("snapshot"),
            OutputAccounting::ExcludesReasoning,
        )
    }
}

fn origins(session: &NormalizedSession, call: usize) -> Vec<(&str, ContextItemKind)> {
    session.model_calls[call - 1]
        .context_item_ids
        .iter()
        .map(|id| {
            let item = session
                .context_items
                .iter()
                .find(|item| &item.id == id)
                .expect("context reference");
            (item.metadata["sourceMessageId"].as_str(), item.kind)
        })
        .collect()
}

fn config() -> AnalysisConfig {
    AnalysisConfig {
        tokenization: TokenizationPolicy::Auto,
        perf_diagnostics: false,
        claude_code_billing: Default::default(),
    }
}

fn validate(result: &ReplayResult) {
    let analysis =
        analyze(result.session.clone(), config()).expect("normalized invariants and DTO assembly");
    assert_eq!(analysis.session.source, "opencode");
    for call in &analysis.model_calls {
        assert!(call.timing.duration_ms.is_none(), "not Pi timing");
        assert!(call.economics.pi_prompt_cost.is_none(), "not Pi economics");
    }
}

#[test]
fn calls_snapshot_input_before_own_output_and_terminal_output_has_no_exposure() {
    let fixture = Fixture::new(false);
    fixture.user(
        "user_1",
        10,
        json!({"type":"text","text":"Synthetic question"}),
    );
    fixture.assistant("assistant_1", "user_1", 20, false);
    fixture.text("assistant_1", "Synthetic answer");
    fixture.user("user_2", 30, json!({"type":"text","text":"Follow-up"}));
    fixture.assistant("assistant_2", "user_2", 40, false);
    fixture.text("assistant_2", "Terminal answer");
    let result = fixture.replay().expect("replay");
    assert_eq!(
        origins(&result.session, 1),
        [("user_1", ContextItemKind::UserMessage)]
    );
    assert_eq!(
        origins(&result.session, 2),
        [
            ("user_1", ContextItemKind::UserMessage),
            ("assistant_1", ContextItemKind::AssistantMessage),
            ("user_2", ContextItemKind::UserMessage)
        ]
    );
    assert!(
        !result
            .session
            .context_items
            .iter()
            .any(|item| item.metadata["sourceMessageId"] == "assistant_2"),
        "unreused output is not input context"
    );
    assert_eq!(
        result.session.model_calls[0].reported_usage.output,
        Some(30)
    );
    assert_eq!(
        result.session.model_calls[0].reported_usage.cost.total,
        Some(0.25)
    );
    assert!(result
        .limitations
        .contains(&ReplayLimitation::MissingHistoricalSystemPrompt));
    assert!(result
        .limitations
        .contains(&ReplayLimitation::MissingHistoricalToolDefinitions));
    assert!(result
        .limitations
        .contains(&ReplayLimitation::UnrecordedRequestTransforms));
    validate(&result);
}

#[test]
fn invocation_and_result_are_separate_and_step_usage_is_not_double_counted() {
    let fixture = Fixture::new(false);
    fixture.user("user_1", 10, json!({"type":"text","text":"Read something"}));
    fixture.assistant("assistant_1", "user_1", 20, false);
    fixture.part("ses_example", "assistant_1", "tool_1", 22, json!({"type":"tool","tool":"read","callID":"call_1","state":{"status":"completed","input":{"filePath":"synthetic.txt"},"output":"Synthetic file body","time":{"start":22,"end":24}}}));
    fixture.assistant("assistant_2", "user_1", 40, false);
    fixture.text("assistant_2", "Done");
    let result = fixture.replay().expect("tools");
    assert_eq!(origins(&result.session, 1).len(), 1);
    assert_eq!(
        origins(&result.session, 2),
        [
            ("user_1", ContextItemKind::UserMessage),
            ("assistant_1", ContextItemKind::AssistantMessage),
            ("assistant_1", ContextItemKind::ToolResult)
        ]
    );
    assert_eq!(
        result.session.model_calls[0].tool_calls_after[0].id,
        "call_1"
    );
    assert!(!result.session.model_calls[0].tool_calls_after[0].failed);
    let analysis = analyze(result.session.clone(), config()).expect("analysis");
    assert_eq!(analysis.session.reported_completion_tokens, Some(60));
    assert_eq!(analysis.session.reported_cost_total, Some(0.5));
    validate(&result);
}

#[test]
fn pruned_tool_results_have_immutable_original_and_placeholder_revisions() {
    let fixture = Fixture::new(false);
    fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
    fixture.assistant("assistant_1", "user_1", 20, false);
    fixture.part("ses_example", "assistant_1", "tool_1", 22, json!({"type":"tool","tool":"bash","callID":"call_1","state":{"status":"completed","input":{"command":"echo synthetic"},"output":"Original output","time":{"start":22,"end":24,"compacted":50}}}));
    fixture.assistant("assistant_2", "user_1", 40, false);
    fixture.text("assistant_2", "Before prune");
    fixture.assistant("assistant_3", "user_1", 60, false);
    fixture.text("assistant_3", "After prune");
    let result = fixture.replay().expect("prune replay");
    let results = result
        .session
        .context_items
        .iter()
        .filter(|item| item.kind == ContextItemKind::ToolResult)
        .collect::<Vec<_>>();
    assert_eq!(results.len(), 2);
    assert_ne!(results[0].id, results[1].id);
    assert_eq!(
        (results[0].first_model_call, results[0].last_model_call),
        (2, 2)
    );
    assert_eq!(
        (results[1].first_model_call, results[1].last_model_call),
        (3, 3)
    );
    assert!(result.session.compactions.is_empty());
    assert!(result.session.lineage.is_empty());
    for (item, expected) in results
        .iter()
        .zip(["Original output", "[Old tool result content cleared]"])
    {
        match &item.payload {
            TokenizationPayload::ToolResult { content, .. } => assert!(
                matches!(&content.parts[0], crate::domain::ContentPart::Text(text) if text == expected)
            ),
            _ => panic!("tool payload"),
        }
    }
    validate(&result);
}

#[test]
fn ambiguous_prune_timestamp_is_reported_not_silently_classified_as_exact() {
    let fixture = Fixture::new(false);
    fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
    fixture.assistant("assistant_1", "user_1", 20, false);
    fixture.part("ses_example", "assistant_1", "tool_1", 22, json!({"type":"tool","tool":"read","callID":"call_1","state":{"status":"completed","input":{},"output":"Original","time":{"compacted":40}}}));
    fixture.assistant("assistant_2", "user_1", 40, false);
    let result = fixture.replay().expect("ambiguous history");
    assert!(result
        .limitations
        .contains(&ReplayLimitation::AmbiguousPruningBoundary));
    validate(&result);
}

#[test]
fn successful_compaction_is_a_real_call_and_replaces_only_subsequent_context() {
    let fixture = Fixture::new(false);
    fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
    fixture.assistant("assistant_1", "user_1", 20, false);
    fixture.text("assistant_1", "Old response");
    fixture.user(
        "marker",
        30,
        json!({"type":"compaction","auto":true,"overflow":false}),
    );
    fixture.assistant("summary", "marker", 40, true);
    fixture.text("summary", "Synthetic summary");
    fixture.user(
        "continue",
        50,
        json!({"type":"text","text":"Continue","synthetic":true}),
    );
    fixture.assistant("assistant_2", "continue", 60, false);
    let result = fixture.replay().expect("compaction");
    assert_eq!(result.session.model_calls.len(), 3);
    assert_eq!(result.session.compactions.len(), 1);
    assert_eq!(result.session.compactions[0].before_model_call, 3);
    assert_eq!(
        origins(&result.session, 2),
        [
            ("user_1", ContextItemKind::UserMessage),
            ("assistant_1", ContextItemKind::AssistantMessage),
            ("marker", ContextItemKind::UserMessage),
            ("summary", ContextItemKind::Other)
        ]
    );
    assert_eq!(
        origins(&result.session, 3),
        [
            ("marker", ContextItemKind::UserMessage),
            ("summary", ContextItemKind::CompactionSummary),
            ("continue", ContextItemKind::UserMessage)
        ]
    );
    assert_eq!(result.session.compactions[0].source_item_ids.len(), 2);
    assert_eq!(result.session.lineage.len(), 2);
    assert!(result.session.lineage.iter().all(|edge| {
        edge.kind == "frameworkCompaction"
            && edge.to == result.session.compactions[0].summary_item_id
            && result.session.compactions[0]
                .source_item_ids
                .contains(&edge.from)
    }));
    assert!(result.session.model_calls[2].compaction_before.is_some());
    assert!(result
        .limitations
        .contains(&ReplayLimitation::UnknownCompactionPrompt));
    validate(&result);
}

#[test]
fn compaction_reasoning_is_preserved_in_subsequent_context_and_token_turns() {
    for with_text in [false, true] {
        let fixture = Fixture::new(false);
        fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
        fixture.user("marker", 30, json!({"type":"compaction","auto":true}));
        fixture.assistant("summary", "marker", 40, true);
        let reasoning = "Recorded summary reasoning";
        fixture.part(
            "ses_example",
            "summary",
            "summary_1_reasoning",
            41,
            json!({"type":"reasoning","text":reasoning}),
        );
        if with_text {
            fixture.text("summary", "Summary text");
        }
        // Terminal summaries keep their structural identity without exposure.
        let terminal = fixture.replay().expect("terminal reasoning summary");
        let summary_id = terminal.session.compactions[0].summary_item_id.clone();
        let terminal_item = terminal
            .session
            .context_items
            .iter()
            .find(|item| item.id == summary_id)
            .expect("terminal summary");
        assert_eq!(terminal_item.kind, ContextItemKind::CompactionSummary);
        assert!(terminal_item.presence.is_empty());
        validate(&terminal);

        fixture.assistant("next", "marker", 60, false);
        let replay = fixture.replay().expect("reused reasoning summary");
        let item = replay
            .session
            .context_items
            .iter()
            .find(|item| item.id == summary_id)
            .expect("summary");
        assert_eq!(item.kind, ContextItemKind::CompactionSummary);
        assert_eq!((item.first_model_call, item.last_model_call), (2, 2));
        assert!(!replay.session.model_calls[0]
            .context_item_ids
            .contains(&summary_id));
        assert!(replay.session.model_calls[1]
            .context_item_ids
            .contains(&summary_id));
        assert_eq!(replay.session.compactions[0].summary_item_id, summary_id);
        assert!(
            matches!(&item.payload, TokenizationPayload::AssistantMessage { blocks, .. }
            if blocks.iter().any(|block| matches!(block,
                crate::domain::AssistantContentBlock::Thinking { text, .. } if text == reasoning)))
        );
        validate(&replay);
        let before = analyze(replay.session, config()).expect("analysis");
        let before_item = before
            .context_items
            .iter()
            .find(|item| item.id == summary_id)
            .expect("analyzed summary");
        let before_tokens = before_item.token_estimates[0]
            .tokens
            .expect("reasoning tokens");
        assert!(before_tokens > 0);
        assert_eq!(before_item.token_turns, Some(before_tokens));
        assert!(before_item
            .preview
            .as_ref()
            .expect("summary preview")
            .expanded_text
            .contains(reasoning));

        fixture
            .writer
            .execute(
                "UPDATE part SET data = ?1 WHERE id = 'summary_1_reasoning'",
                [json!({"type":"reasoning","text":reasoning.repeat(100)}).to_string()],
            )
            .expect("expand recorded reasoning");
        let after = analyze(fixture.replay().expect("expanded replay").session, config())
            .expect("expanded analysis");
        let after_item = after
            .context_items
            .iter()
            .find(|item| item.id == summary_id)
            .expect("expanded summary");
        assert!(
            after_item.token_estimates[0]
                .tokens
                .expect("expanded tokens")
                > before_tokens
        );
        assert!(after_item.token_turns > before_item.token_turns);
    }
}

#[test]
fn unsupported_summary_blocks_do_not_become_complete_text_estimates() {
    let fixture = Fixture::new(false);
    fixture.user("marker", 30, json!({"type":"compaction","auto":true}));
    fixture.assistant("summary", "marker", 40, true);
    fixture.text("summary", "Summary text");
    fixture.part(
        "ses_example",
        "summary",
        "summary_2_unknown",
        42,
        json!({"type":"unknown-content"}),
    );
    fixture.assistant("next", "marker", 60, false);
    let replay = fixture.replay().expect("unsupported summary content");
    assert!(replay
        .limitations
        .contains(&ReplayLimitation::UnsupportedContent));
    validate(&replay);
    let analysis = analyze(replay.session, config()).expect("partial analysis");
    let summary = analysis
        .context_items
        .iter()
        .find(|item| item.kind == "compactionSummary")
        .expect("summary");
    assert_eq!(summary.token_estimates[0].coverage.as_str(), "partial");
}

#[test]
fn overflow_summary_excludes_the_last_user_turn_only_when_an_earlier_turn_remains() {
    for older_turn in [false, true] {
        let fixture = Fixture::new(false);
        if older_turn {
            fixture.user("old_user", 5, json!({"type":"text","text":"Older task"}));
            fixture.assistant("old_assistant", "old_user", 8, false);
            fixture.text("old_assistant", "Older response");
        }
        fixture.user(
            "last_user",
            10,
            json!({"type":"text","text":"Latest request"}),
        );
        fixture.user(
            "marker",
            30,
            json!({"type":"compaction","auto":true,"overflow":true}),
        );
        fixture.assistant("summary", "marker", 40, true);
        fixture.text("summary", "Summary");
        let result = fixture.replay().expect("overflow compaction");
        let summary_call = result.session.model_calls.len();
        let members = origins(&result.session, summary_call);
        assert_eq!(
            members.contains(&("last_user", ContextItemKind::UserMessage)),
            !older_turn
        );
        assert_eq!(
            members.contains(&("marker", ContextItemKind::UserMessage)),
            !older_turn
        );
        if older_turn {
            assert!(members.contains(&("old_user", ContextItemKind::UserMessage)));
            assert!(members.contains(&("old_assistant", ContextItemKind::AssistantMessage)));
        }
        validate(&result);
    }
}

#[test]
fn terminal_summary_is_selectable_without_fabricated_call_or_exposure() {
    let fixture = Fixture::new(false);
    fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
    fixture.assistant("assistant_1", "user_1", 20, false);
    fixture.text("assistant_1", "Old response");
    fixture.user(
        "marker",
        30,
        json!({"type":"compaction","auto":true,"overflow":false}),
    );
    fixture.assistant("summary", "marker", 40, true);
    fixture.text("summary", "Summary");
    let result = fixture.replay().expect("terminal summary");
    assert_eq!(result.session.model_calls.len(), 2);
    let summary = result
        .session
        .context_items
        .iter()
        .find(|item| item.kind == ContextItemKind::CompactionSummary)
        .expect("summary");
    assert!(summary.presence.is_empty());
    assert_eq!(result.session.compactions[0].before_model_call, 3);
    validate(&result);
}

#[test]
fn failed_summary_does_not_erase_conversation() {
    let fixture = Fixture::new(false);
    fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
    fixture.assistant("assistant_1", "user_1", 20, false);
    fixture.text("assistant_1", "Old response");
    fixture.user(
        "marker",
        30,
        json!({"type":"compaction","auto":true,"overflow":false}),
    );
    fixture.assistant("summary", "marker", 40, true);
    fixture.text("summary", "Partial summary");
    fixture.writer.execute("UPDATE message SET data = json_set(data, '$.error', json('{\"name\":\"APIError\"}'), '$.finish', 'error') WHERE id = 'summary'", []).expect("failed summary");
    fixture.assistant("assistant_2", "marker", 60, false);
    let result = fixture.replay().expect("failed compaction");
    assert!(result.session.compactions.is_empty());
    assert!(origins(&result.session, 3).contains(&("user_1", ContextItemKind::UserMessage)));
    assert!(!origins(&result.session, 3).contains(&("summary", ContextItemKind::CompactionSummary)));
    validate(&result);
}

#[test]
fn ignored_text_is_excluded_synthetic_text_is_included_and_file_references_are_not_read() {
    let fixture = Fixture::new(false);
    fixture.user(
        "ignored",
        5,
        json!({"type":"text","text":"Ignored","ignored":true}),
    );
    fixture.user(
        "user_1",
        10,
        json!({"type":"text","text":"Included","synthetic":true}),
    );
    fixture.part(
        "ses_example",
        "user_1",
        "file_plain",
        11,
        json!({"type":"file","mime":"text/plain","url":"file:///unreadable/synthetic"}),
    );
    fixture.part(
        "ses_example",
        "user_1",
        "file_image",
        12,
        json!({"type":"file","mime":"image/png","url":"https://invalid.example/no-fetch"}),
    );
    fixture.assistant("assistant_1", "user_1", 20, false);
    let result = fixture.replay().expect("content projection");
    assert_eq!(
        origins(&result.session, 1),
        [("user_1", ContextItemKind::UserMessage)]
    );
    assert!(result
        .limitations
        .contains(&ReplayLimitation::UnsupportedContent));
    match &result.session.context_items[0].payload {
        TokenizationPayload::UserMessage(content) => assert_eq!(content.parts.len(), 2),
        _ => panic!("user payload"),
    }
    validate(&result);
}

#[test]
fn unpaired_summary_flag_never_invents_a_compaction_boundary() {
    let fixture = Fixture::new(false);
    fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
    fixture.assistant("summary", "user_1", 20, true);
    fixture.text("summary", "Recorded summary without marker");
    fixture.assistant("assistant_2", "user_1", 40, false);
    let result = fixture.replay().expect("unpaired summary");
    assert!(result.session.compactions.is_empty());
    assert!(result.session.lineage.is_empty());
    assert!(origins(&result.session, 2).contains(&("user_1", ContextItemKind::UserMessage)));
    assert!(result
        .limitations
        .contains(&ReplayLimitation::UnpairedCompactionSummary));
    validate(&result);
}

#[test]
fn missing_steps_do_not_turn_initialized_usage_into_measured_zero() {
    let fixture = Fixture::new(false);
    fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
    fixture.assistant("assistant_1", "user_1", 20, false);
    fixture
        .writer
        .execute(
            "DELETE FROM part WHERE json_extract(data, '$.type') = 'step-finish'",
            [],
        )
        .expect("no completed step");
    let result = fixture.replay().expect("attempted call");
    assert!(result.session.model_calls[0].reported_usage.input.is_none());
    assert!(result.session.model_calls[0]
        .reported_usage
        .cost
        .total
        .is_none());
    validate(&result);
}

#[test]
fn shell_and_subtask_assistants_without_model_steps_are_rejected() {
    for subtask in [false, true] {
        for status in ["completed", "error", "pending", "running"] {
            let fixture = Fixture::new(false);
            fixture.user(
                "user_1",
                10,
                if subtask {
                    json!({"type":"subtask","agent":"explore","prompt":"Synthetic task","description":"Task"})
                } else {
                    json!({"type":"text","text":"The following tool was executed by the user","synthetic":true})
                },
            );
            // Both source handlers use the agent name as mode and initialize
            // accounting, but neither calls the model or writes step parts.
            fixture.message(
                "ses_example",
                "synthetic_assistant",
                20,
                json!({
                    "role":"assistant","parentID":"user_1","providerID":"synthetic-provider",
                    "modelID":"synthetic-model","mode":"build","agent":"build",
                    "time":{"created":20,"completed":25},"cost":0,
                    "tokens":{"input":0,"output":0,"reasoning":0,"cache":{"read":0,"write":0}}
                }),
            );
            fixture.part("ses_example", "synthetic_assistant", "tool_1", 21, json!({
                "type":"tool","tool":if subtask { "task" } else { "bash" },"callID":"call_1",
                "state":{"status":status,"input":{},"output":"Synthetic output","error":"Synthetic error",
                    "time":{"start":21,"end":24}}
            }));
            fixture.user("user_2", 30, json!({"type":"text","text":"Continue"}));
            fixture.assistant("assistant_2", "user_2", 40, false);
            assert!(
                matches!(fixture.replay(), Err(ReplayError::UnsupportedHistory)),
                "subtask={subtask}, status={status}"
            );
        }
    }
}

#[test]
fn unfinished_tool_call_with_a_recorded_step_start_remains_inspectable() {
    let fixture = Fixture::new(false);
    fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
    fixture.assistant("assistant_1", "user_1", 20, false);
    fixture
        .writer
        .execute("DELETE FROM part WHERE id = 'assistant_1_9_finish'", [])
        .expect("unfinished model step");
    fixture.part("ses_example", "assistant_1", "tool_1", 21, json!({"type":"tool","tool":"bash","callID":"call_1","state":{"status":"running","input":{},"time":{"start":21}}}));
    fixture.assistant("assistant_2", "user_1", 40, false);
    let result = fixture.replay().expect("recorded model attempt");
    assert_eq!(result.session.model_calls.len(), 2);
    assert!(result.session.model_calls[0].reported_usage.input.is_none());
    assert!(origins(&result.session, 2).contains(&("assistant_1", ContextItemKind::ToolResult)));
    validate(&result);
}

#[test]
fn agent_mode_does_not_override_verified_model_steps() {
    let fixture = Fixture::new(false);
    fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
    fixture.assistant("assistant_1", "user_1", 20, false);
    fixture.writer.execute("UPDATE message SET data = json_set(data, '$.mode', 'shell', '$.agent', 'shell') WHERE id = 'assistant_1'", []).expect("agent named shell");
    fixture.part("ses_example", "assistant_1", "tool_1", 21, json!({"type":"tool","tool":"bash","callID":"call_1","state":{"status":"completed","input":{},"output":"Synthetic output","time":{"start":21,"end":24}}}));
    let result = fixture.replay().expect("verified model step");
    assert_eq!(result.session.model_calls.len(), 1);
    validate(&result);
}

#[test]
fn aborted_reasoning_eligibility_uses_original_source_parts() {
    for extra in [
        None,
        Some("step-finish"),
        Some("patch"),
        Some("snapshot"),
        Some("retry"),
    ] {
        let fixture = Fixture::new(false);
        fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
        fixture.assistant("assistant_1", "user_1", 20, false);
        fixture.part(
            "ses_example",
            "assistant_1",
            "assistant_1_1_reason",
            21,
            json!({"type":"reasoning","text":"Recorded reasoning","time":{"start":21,"end":22}}),
        );
        if extra != Some("step-finish") {
            fixture
                .writer
                .execute("DELETE FROM part WHERE id = 'assistant_1_9_finish'", [])
                .expect("no step-finish");
            if let Some(kind) = extra {
                fixture.part("ses_example", "assistant_1", "assistant_1_2_structural", 22, json!({"type":kind,"snapshot":"synthetic-hash","hash":"synthetic-hash","files":[],"attempt":1}));
            }
        }
        fixture.writer.execute("UPDATE message SET data = json_set(data, '$.error', json('{\"name\":\"MessageAbortedError\",\"data\":{\"message\":\"aborted\"}}')) WHERE id = 'assistant_1'", []).expect("abort");
        fixture.assistant("assistant_2", "user_1", 40, false);
        let result = fixture.replay().expect("aborted replay");
        assert_eq!(
            origins(&result.session, 2)
                .contains(&("assistant_1", ContextItemKind::AssistantMessage)),
            extra.is_some(),
            "extra={extra:?}"
        );
        if extra.is_some() {
            let item = result
                .session
                .context_items
                .iter()
                .find(|item| item.metadata["sourceMessageId"] == "assistant_1")
                .expect("reused reasoning");
            assert!(
                matches!(&item.payload, TokenizationPayload::AssistantMessage { blocks, .. } if matches!(blocks.as_slice(), [crate::domain::AssistantContentBlock::Thinking { text, .. }] if text == "Recorded reasoning"))
            );
        }
        assert!(!result
            .limitations
            .contains(&ReplayLimitation::UnsupportedContent));
        validate(&result);
    }
}

#[test]
fn known_structural_parts_do_not_create_or_degrade_context_items() {
    for mixed_text in [false, true] {
        let fixture = Fixture::new(false);
        fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
        fixture.assistant("assistant_1", "user_1", 20, false);
        for kind in ["snapshot", "retry", "patch", "agent"] {
            fixture.part("ses_example", "assistant_1", &format!("metadata_{kind}"), 21, json!({"type":kind,"snapshot":"synthetic-hash","hash":"synthetic-hash","files":[],"attempt":1,"name":"build"}));
        }
        if mixed_text {
            fixture.text("assistant_1", "Recorded answer");
        }
        fixture.assistant("assistant_2", "user_1", 40, false);
        let result = fixture.replay().expect("structural projection");
        assert_eq!(
            origins(&result.session, 2)
                .contains(&("assistant_1", ContextItemKind::AssistantMessage)),
            mixed_text
        );
        if mixed_text {
            let item = result
                .session
                .context_items
                .iter()
                .find(|item| item.metadata["sourceMessageId"] == "assistant_1")
                .expect("text item");
            assert!(
                matches!(&item.payload, TokenizationPayload::AssistantMessage { blocks, .. } if matches!(blocks.as_slice(), [crate::domain::AssistantContentBlock::Text(text)] if text == "Recorded answer"))
            );
        }
        assert!(!result
            .limitations
            .contains(&ReplayLimitation::UnsupportedContent));
        validate(&result);
    }
}

#[test]
fn user_agent_metadata_is_not_model_content() {
    let fixture = Fixture::new(false);
    fixture.user("agent_only", 5, json!({"type":"agent","name":"build"}));
    fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
    fixture.part(
        "ses_example",
        "user_1",
        "user_agent",
        11,
        json!({"type":"agent","name":"build"}),
    );
    fixture.assistant("assistant_1", "user_1", 20, false);
    let result = fixture.replay().expect("user metadata");
    assert_eq!(
        origins(&result.session, 1),
        [("user_1", ContextItemKind::UserMessage)]
    );
    assert!(!result
        .limitations
        .contains(&ReplayLimitation::UnsupportedContent));
    assert!(
        matches!(&result.session.context_items[0].payload, TokenizationPayload::UserMessage(content) if matches!(content.parts.as_slice(), [crate::domain::ContentPart::Text(text)] if text == "Task"))
    );
    validate(&result);
}

#[test]
fn unknown_assistant_content_remains_explicitly_unsupported() {
    let fixture = Fixture::new(false);
    fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
    fixture.assistant("assistant_1", "user_1", 20, false);
    fixture.part(
        "ses_example",
        "assistant_1",
        "unknown_part",
        21,
        json!({"type":"unknown-future-content"}),
    );
    fixture.assistant("assistant_2", "user_1", 40, false);
    let result = fixture.replay().expect("qualified content");
    assert!(
        origins(&result.session, 2).contains(&("assistant_1", ContextItemKind::AssistantMessage))
    );
    assert!(result
        .limitations
        .contains(&ReplayLimitation::UnsupportedContent));
    validate(&result);
}

#[test]
fn stored_total_shows_whether_output_includes_reasoning() {
    // 80 + 20 + 10 + 20 = 130: the v1.4.0 layout, with reasoning outside output.
    let fixture = Fixture::new(false);
    fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
    fixture.assistant("assistant_1", "user_1", 20, false);
    let replay = |fixture: &Fixture| {
        reconstruct(
            load_session(&fixture.path, "ses_example", None).expect("snapshot"),
            OutputAccounting::Unknown,
        )
        .expect("replay")
    };
    let separate = replay(&fixture);
    let usage = &separate.session.model_calls[0].reported_usage;
    assert_eq!((usage.output, usage.recorded_output), (Some(30), Some(20)));
    assert_eq!(
        usage.output_reasoning_relationship,
        OutputReasoningRelationship::ExcludesReasoning
    );
    assert!(!separate
        .limitations
        .contains(&ReplayLimitation::UnknownOutputAccounting));
    validate(&separate);

    // 80 + 20 + 20 = 120: the v1.3 layout, with reasoning inside output.
    fixture
        .writer
        .execute(
            "UPDATE part SET data = json_set(data, '$.tokens.total', 120) WHERE id = 'assistant_1_9_finish'",
            [],
        )
        .expect("inclusive total");
    let inclusive = replay(&fixture);
    let usage = &inclusive.session.model_calls[0].reported_usage;
    assert_eq!(usage.output, Some(20));
    assert_eq!(
        usage.output_reasoning_relationship,
        OutputReasoningRelationship::IncludesReasoning
    );
}

#[test]
fn unaudited_writer_and_unverified_transport_stay_explicit() {
    // Without a total that fits either layout, the overlap stays unknown.
    let fixture = Fixture::new(false);
    fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
    fixture.assistant("assistant_1", "user_1", 20, false);
    fixture
        .writer
        .execute(
            "UPDATE part SET data = json_set(data, '$.tokens.total', 999) WHERE id = 'assistant_1_9_finish'",
            [],
        )
        .expect("unexplained total");
    let result = reconstruct(
        load_session(&fixture.path, "ses_example", None).expect("snapshot"),
        OutputAccounting::Unknown,
    )
    .expect("unknown writer");
    assert!(result.session.model_calls[0].target.api.is_none());
    assert!(result.session.model_calls[0]
        .reported_usage
        .output
        .is_none());
    assert_eq!(
        result.session.model_calls[0].reported_usage.reasoning,
        Some(10)
    );
    assert!(result
        .limitations
        .contains(&ReplayLimitation::UnknownOutputAccounting));
    validate(&result);
}

#[test]
fn unaudited_tail_revert_and_multistep_histories_are_rejected() {
    for sql in [
        "UPDATE part SET data = json_set(data, '$.tail_start_id', 'user_1') WHERE message_id = 'marker'",
        "UPDATE session SET revert = '{\"messageID\":\"user_1\"}'",
        "INSERT INTO part SELECT 'extra_step', message_id, session_id, time_created, time_updated, data FROM part WHERE id = 'summary_9_finish'",
    ] {
        let fixture = Fixture::new(false);
        fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
        fixture.user("marker", 30, json!({"type":"compaction","auto":true,"overflow":false}));
        fixture.assistant("summary", "marker", 40, true);
        fixture.text("summary", "Summary");
        fixture.writer.execute(sql, []).expect("unsupported semantics fixture");
        assert!(matches!(fixture.replay(), Err(ReplayError::UnsupportedHistory)), "{sql}");
    }
}

#[test]
fn source_neutral_loader_preserves_database_revision_and_replay_qualifications() {
    use crate::source::{load, SessionLocator};
    let fixture = Fixture::new(false);
    fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
    fixture.assistant("assistant_1", "user_1", 20, false);
    let locator = SessionLocator::OpenCode {
        database: fixture.path.clone(),
        native_id: "ses_example".into(),
    };
    let loaded = load(&locator, None).expect("source-neutral loading");
    assert_eq!(loaded.normalized.source.kind, "opencode");
    assert_eq!(loaded.stats.records, 5);
    assert_eq!(loaded.stats.selected_records, 5);
    assert_eq!(
        loaded.database_revision,
        Some(
            load_session(&fixture.path, "ses_example", None)
                .expect("same source snapshot")
                .revision
        )
    );
    // The fixture's stored total shows output excludes reasoning.
    assert!(!loaded
        .replay_limitations
        .contains(&ReplayLimitation::UnknownOutputAccounting));
    assert_eq!(
        loaded.normalized.model_calls[0].reported_usage.output,
        Some(30)
    );
}

#[test]
fn replay_ids_and_membership_are_stable_across_repeated_reads() {
    let fixture = Fixture::new(false);
    fixture.user("user_1", 10, json!({"type":"text","text":"Task"}));
    fixture.assistant("assistant_1", "user_1", 20, false);
    fixture.text("assistant_1", "Response");
    let first = fixture.replay().expect("first");
    let second = fixture.replay().expect("second");
    assert_eq!(
        first
            .session
            .context_items
            .iter()
            .map(|item| &item.id)
            .collect::<Vec<_>>(),
        second
            .session
            .context_items
            .iter()
            .map(|item| &item.id)
            .collect::<Vec<_>>()
    );
    assert_eq!(
        first.session.model_calls[0].context_item_ids,
        second.session.model_calls[0].context_item_ids
    );
}
