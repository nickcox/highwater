use super::*;
use std::fs::File;
use std::io::{BufReader, Cursor};

#[test]
fn failed_default_usage_is_unavailable_but_retains_raw_placeholders() {
    for stop in ["error", "aborted"] {
        let message = serde_json::json!({"stopReason":stop,"content":[{"type":"text","text":"partial"}],
            "usage":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"totalTokens":0,
            "cost":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"total":0}}});
        let usage = parse_assistant_usage(&message).expect("usage");
        let raw = usage.placeholder.as_ref().expect("raw default usage");
        assert_eq!(raw.reasoning, None);
        assert_eq!(raw.cost.total, Some(0.0));
        assert!(usage.input.is_none() && usage.output.is_none() && usage.recorded_output.is_none());
        assert!(
            usage.cache_read.is_none()
                && usage.cache_write.is_none()
                && usage.total_tokens.is_none()
        );
        assert!(usage.cost.total.is_none());
        for field in [
            "input",
            "output",
            "cacheRead",
            "cacheWrite",
            "reasoning",
            "totalTokens",
            "cacheWrite1h",
        ] {
            let mut measured = message.clone();
            measured["usage"][field] = serde_json::json!(1);
            assert!(
                parse_assistant_usage(&measured)
                    .expect("nonzero usage")
                    .placeholder
                    .is_none(),
                "{field}"
            );
        }
        let mut measured_cost = message.clone();
        measured_cost["usage"]["cost"]["total"] = serde_json::json!(0.01);
        assert!(parse_assistant_usage(&measured_cost)
            .expect("recorded cost")
            .placeholder
            .is_none());
        let mut incomplete = message.clone();
        incomplete["usage"]
            .as_object_mut()
            .expect("usage")
            .remove("totalTokens");
        assert!(parse_assistant_usage(&incomplete)
            .expect("incomplete usage")
            .placeholder
            .is_none());
        let mut unsafe_counter = message.clone();
        unsafe_counter["usage"]["output"] = serde_json::json!(MAX_SAFE_JSON_INTEGER + 1);
        assert!(parse_assistant_usage(&unsafe_counter).is_err());
    }
    let success = serde_json::json!({"stopReason":"stop","usage":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"totalTokens":0}});
    let measured = parse_assistant_usage(&success).expect("measured zero");
    assert!(measured.placeholder.is_none());
    assert_eq!(measured.input, Some(0));
    assert_eq!(measured.output, Some(0));
    assert_eq!(measured.total_tokens, Some(0));
    assert!(
        parse_assistant_usage(&serde_json::json!({"stopReason":"error"}))
            .expect("missing")
            .placeholder
            .is_none()
    );
}

#[test]
fn recorded_pi_output_and_optional_reasoning_remain_separate_without_changing_totals() {
    for reasoning in [None, Some(0), Some(30)] {
        let mut value = serde_json::json!({"output":100});
        if let Some(reasoning) = reasoning {
            value["reasoning"] = serde_json::json!(reasoning);
        }
        let usage = parse_usage(Some(&value)).expect("Pi usage");
        assert_eq!(usage.recorded_output, Some(100));
        assert_eq!(usage.output, Some(100), "reasoning is not added twice");
        assert_eq!(usage.reasoning, reasoning);
        assert_eq!(
            usage.output_reasoning_relationship,
            OutputReasoningRelationship::IncludesReasoning
        );
    }
    let absent = parse_usage(None).expect("no usage");
    assert!(absent.recorded_output.is_none());
    assert!(absent.reasoning.is_none());
    assert_eq!(
        absent.output_reasoning_relationship,
        OutputReasoningRelationship::Unknown
    );
}

fn fixture(name: &str) -> NormalizedSession {
    let file = File::open(format!("fixtures/pi/{name}.jsonl")).expect("fixture");
    PiSourceAdapter
        .parse(&mut BufReader::new(file))
        .expect("normalized fixture")
}

fn parse_records(records: &[Value]) -> NormalizedSession {
    let jsonl = records
        .iter()
        .map(|record| serde_json::to_string(record).expect("JSON record"))
        .collect::<Vec<_>>()
        .join("\n");
    PiSourceAdapter
        .parse(&mut Cursor::new(jsonl))
        .expect("normalized test session")
}

fn message_record(id: &str, parent: Option<&str>, message: Value) -> Value {
    serde_json::json!({
        "type": "message",
        "id": id,
        "parentId": parent,
        "message": message,
    })
}

fn item_label_for_record<'a>(session: &'a NormalizedSession, record_id: &str) -> &'a str {
    session
        .context_items
        .iter()
        .find(|item| item.source_record_id.as_deref() == Some(record_id))
        .map(|item| item.label.as_str())
        .expect("context item for source record")
}

#[test]
fn source_base64_length_is_encoded_size_not_decoded_image_size() {
    let session = parse_records(&[
        serde_json::json!({"type": "session", "id": "encoded", "version": 3}),
        message_record(
            "image",
            None,
            serde_json::json!({"role": "user", "content": [{"type": "image", "mimeType": "image/png", "data": "aGVsbG8="}]}),
        ),
        message_record(
            "call",
            Some("image"),
            serde_json::json!({"role": "assistant", "content": [{"type": "text", "text": "seen"}]}),
        ),
    ]);
    let item = &session.context_items[0];
    let TokenizationPayload::UserMessage(content) = &item.payload else {
        panic!("user payload");
    };
    let ContentPart::Image(image) = &content.parts[0] else {
        panic!("image metadata");
    };
    assert_eq!(image.encoded_data_length, Some(8)); // Encoded "hello", not its five decoded bytes.
    let analysis = crate::analysis::analyze(
        session,
        crate::analysis::AnalysisConfig {
            tokenization: crate::analysis::TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
        },
    )
    .expect("image analysis");
    let preview = analysis.context_items[0].preview.as_ref().expect("preview");
    assert_eq!(preview.text, "[image: image/png, 8.0 B encoded]");
    assert_eq!(preview.expanded_text, preview.text);
    assert_eq!(
        analysis.context_items[0].token_estimates[0].coverage,
        "partial"
    );
}

#[test]
fn assistant_wall_clock_instants_are_normalized_independently() {
    let mut response = message_record(
        "a",
        None,
        serde_json::json!({
            "role":"assistant", "api":"openai-codex-responses", "stopReason":"stop",
            "timestamp":1700000000000_i64, "content":[], "usage":{"output":100}
        }),
    );
    response["timestamp"] = serde_json::json!("2023-11-15T00:13:22+02:00");
    let header = serde_json::json!({"type":"session","id":"timed","version":3});
    let session = parse_records(&[header.clone(), response.clone()]);
    assert_eq!(
        session.model_calls[0].timestamps,
        CallTimestamps {
            started_at_ms: Some(1700000000000),
            recorded_at_ms: Some(1700000002000)
        }
    );
    // Malformed optional metadata must not reject otherwise usable sessions,
    // and a missing/invalid start must not discard a valid recording instant.
    for value in [
        serde_json::json!("invalid"),
        serde_json::json!(1.5),
        serde_json::json!(i64::MAX),
        Value::Null,
    ] {
        response["message"]["timestamp"] = value;
        let session = parse_records(&[header.clone(), response.clone()]);
        assert_eq!(session.model_calls[0].timestamps.started_at_ms, None);
        assert_eq!(
            session.model_calls[0].timestamps.recorded_at_ms,
            Some(1700000002000)
        );
    }
    response["message"]["timestamp"] = serde_json::json!(0);
    response["timestamp"] = serde_json::json!("invalid");
    let session = parse_records(&[header, response]);
    assert_eq!(session.model_calls[0].timestamps.started_at_ms, Some(0));
    assert_eq!(session.model_calls[0].timestamps.recorded_at_ms, None);
}

/// Pins the normalized form of every Pi fixture, so a change to how Pi sessions are read fails
/// here. When it changes on purpose, update the digest and say why in the commit message.
#[test]
fn normalized_fixture_parity() {
    let mut digest = blake3::Hasher::new();
    for name in [
        "aborted-assistant",
        "branch",
        "compaction-metadata",
        "compaction",
        "context-entry-kinds",
        "economics-policies",
        "errored-assistant",
        "failed-tool",
        "multiple-compactions",
        "simple",
        "terminal-compaction",
        "tools",
    ] {
        digest.update(format!("{:?}", fixture(name)).as_bytes());
    }
    assert_eq!(
        digest.finalize().to_hex().as_str(),
        "11195ad77b213e53bbebf3eaa662c0bc888588f8171188f7914304fdff2665ee"
    );
}

#[test]
fn reader_and_path_stats_share_reconstruction() {
    let reader_session = fixture("simple");
    let (path_session, stats) = PiSourceAdapter
        .parse_path_with_stats(Path::new("fixtures/pi/simple.jsonl"))
        .expect("path fixture");
    assert!(stats.entries >= stats.selected_entries);
    assert_eq!(reader_session.id, path_session.id);
    assert_eq!(
        reader_session.model_calls.len(),
        path_session.model_calls.len()
    );
    assert_eq!(
        reader_session
            .model_calls
            .iter()
            .map(|call| &call.context_item_ids)
            .collect::<Vec<_>>(),
        path_session
            .model_calls
            .iter()
            .map(|call| &call.context_item_ids)
            .collect::<Vec<_>>()
    );
    assert_eq!(
        reader_session.context_items.len(),
        path_session.context_items.len()
    );
    assert_eq!(
        reader_session.compactions.len(),
        path_session.compactions.len()
    );
}

#[test]
fn consecutive_compactions_keep_stable_indexes_and_defer_response_filtering() {
    let session = parse_records(&[
        message_record(
            "u1",
            None,
            serde_json::json!({"role":"user","content":"first"}),
        ),
        message_record(
            "a1",
            Some("u1"),
            serde_json::json!({"role":"assistant","content":"first answer"}),
        ),
        message_record(
            "u2",
            Some("a1"),
            serde_json::json!({"role":"user","content":"retained"}),
        ),
        serde_json::json!({"type":"compaction","id":"c1","parentId":"u2","summary":"first summary","firstKeptEntryId":"u2"}),
        serde_json::json!({"type":"compaction","id":"c2","parentId":"c1","summary":"second summary","firstKeptEntryId":"u2"}),
        message_record(
            "a2",
            Some("c2"),
            serde_json::json!({"role":"assistant","content":"second answer"}),
        ),
        message_record(
            "a3",
            Some("a2"),
            serde_json::json!({"role":"assistant","content":"last answer"}),
        ),
    ]);
    assert_eq!(suffixes(&session, 1), vec!["u1"]);
    // The first summary is newer than the retained-tail boundary, so it
    // remains in that tail under the existing source-local semantics.
    assert_eq!(suffixes(&session, 2), vec!["c2", "c1", "u2"]);
    assert_eq!(suffixes(&session, 3), vec!["c2", "c1", "u2", "a2"]);
    assert_eq!(session.compactions.len(), 2);
    assert!(session.compactions[1].summary_item_id.ends_with(":c2"));
    assert_eq!(session.compactions[1].before_model_call, 2);
    assert!(session.compactions[1]
        .retained_item_ids
        .iter()
        .any(|id| id.ends_with(":c1")));
    let response = session
        .context_items
        .iter()
        .find(|item| item.source_record_id.as_deref() == Some("a2"))
        .expect("response used by next call");
    assert_eq!(response.first_model_call, 3);
    assert_eq!(
        response.presence,
        vec![PresenceRange {
            start_call: 3,
            end_call: 3
        }]
    );
    let summary = session
        .context_items
        .iter()
        .find(|item| item.kind == ContextItemKind::CompactionSummary)
        .expect("current summary");
    assert_eq!(
        summary.presence,
        vec![PresenceRange {
            start_call: 2,
            end_call: 3
        }]
    );
}

#[test]
fn command_shaped_and_unknown_records_remain_ignored() {
    let session = parse_records(&[
        message_record(
            "u1",
            None,
            serde_json::json!({"role":"user","content":"hello"}),
        ),
        serde_json::json!({"type":"command","id":"cmd","parentId":"u1","command":"echo hello","output":"hello","message":{"role":"user","content":"not context"}}),
        message_record(
            "a1",
            Some("cmd"),
            serde_json::json!({"role":"assistant","content":"answer"}),
        ),
        serde_json::json!({"type":"future-event","id":"future","parentId":"a1","content":"ignored"}),
        message_record(
            "a2",
            Some("future"),
            serde_json::json!({"role":"assistant","content":"final"}),
        ),
    ]);
    assert_eq!(suffixes(&session, 1), vec!["u1"]);
    assert_eq!(suffixes(&session, 2), vec!["u1", "a1"]);
    assert!(session
        .context_items
        .iter()
        .all(|item| !matches!(item.payload, TokenizationPayload::CommandExecution { .. })));
}

#[test]
fn failed_tool_lookahead_uses_only_the_selected_branch() {
    let session = parse_records(&[
        message_record(
            "u1",
            None,
            serde_json::json!({"role":"user","content":"run tools"}),
        ),
        message_record(
            "a1",
            Some("u1"),
            serde_json::json!({"role":"assistant","content":[{"type":"toolCall","id":"selected-tool","name":"bash","arguments":{}},{"type":"toolCall","id":"other-tool","name":"bash","arguments":{}}]}),
        ),
        message_record(
            "other-result",
            Some("a1"),
            serde_json::json!({"role":"toolResult","toolCallId":"other-tool","isError":true,"content":"unselected failure"}),
        ),
        message_record(
            "selected-result",
            Some("a1"),
            serde_json::json!({"role":"toolResult","toolCallId":"selected-tool","isError":true,"content":"selected failure"}),
        ),
        message_record(
            "a2",
            Some("selected-result"),
            serde_json::json!({"role":"assistant","content":"done"}),
        ),
    ]);
    assert!(session.model_calls[0].tool_calls_after[0].failed);
    assert!(!session.model_calls[0].tool_calls_after[1].failed);
    assert_eq!(suffixes(&session, 2), vec!["u1", "a1", "selected-result"]);
}

#[test]
fn branch_selection_and_compaction_are_source_local() {
    let session = fixture("compaction");
    assert_eq!(session.model_calls.len(), 3);
    assert_eq!(session.model_calls[2].context_item_ids.len(), 4);
    assert_eq!(session.compactions[0].tokens_before, Some(100));
    assert!(session
        .lineage
        .iter()
        .all(|edge| edge.kind == "frameworkCompaction"));
}

fn suffixes(session: &NormalizedSession, index: usize) -> Vec<String> {
    session.model_calls[index - 1]
        .context_item_ids
        .iter()
        .map(|id| id.rsplit(':').next().unwrap_or(id).to_owned())
        .collect()
}

#[test]
fn historical_context_membership_and_branch_selection_are_exact() {
    let simple = fixture("simple");
    assert_eq!(suffixes(&simple, 1), vec!["u1"]);
    assert_eq!(suffixes(&simple, 2), vec!["u1", "a1", "u2"]);
    let branch = fixture("branch");
    assert_eq!(suffixes(&branch, 2), vec!["u1", "a1", "u2b"]);
    let tools = fixture("tools");
    assert_eq!(suffixes(&tools, 2), vec!["u1", "a1", "r1"]);
}

#[test]
fn errored_and_aborted_assistants_are_not_reused_as_context() {
    for fixture_name in ["errored-assistant", "aborted-assistant"] {
        let session = fixture(fixture_name);
        assert_eq!(session.model_calls.len(), 2);
        assert!(session.model_calls[0]
            .context_item_ids
            .iter()
            .all(|id| !id.ends_with(":entry:a1")));
        assert!(session.model_calls[1]
            .context_item_ids
            .iter()
            .all(|id| !id.ends_with(":entry:a1")));
        assert!(session
            .context_items
            .iter()
            .all(|item| !item.id.ends_with(":entry:a1")));
    }
}

#[test]
fn compaction_preserves_retained_tail_and_starts_summary_exposure() {
    let session = fixture("compaction");
    let event = &session.compactions[0];
    assert_eq!(event.before_model_call, 3);
    assert!(event
        .source_item_ids
        .iter()
        .any(|id| id.ends_with(":entry:u1")));
    assert!(event
        .retained_item_ids
        .iter()
        .any(|id| id.ends_with(":entry:r1")));
    let summary = session
        .context_items
        .iter()
        .find(|item| item.id == event.summary_item_id)
        .expect("summary");
    assert_eq!(summary.first_model_call, 3);
    assert_eq!(
        summary.presence,
        vec![PresenceRange {
            start_call: 3,
            end_call: 3
        }]
    );
}

#[test]
fn terminal_compaction_summary_is_kept_without_fake_presence() {
    let session = fixture("terminal-compaction");
    let event = &session.compactions[0];
    let summary = session
        .context_items
        .iter()
        .find(|item| item.id == event.summary_item_id)
        .expect("summary");
    assert!(summary.presence.is_empty());
    assert_eq!(summary.first_model_call, 0);
}

#[test]
fn malformed_or_unknown_content_is_preserved_as_unsupported() {
    let message = serde_json::json!({
        "content": [
            {"type": "text", "text": "known"},
            {"type": "futureBlock", "value": "do not expose"},
            {"type": "toolCall", "id": "call-1", "name": "bash"}
        ]
    });
    let blocks = assistant_blocks(&message);
    assert!(matches!(blocks[0], AssistantContentBlock::Text(_)));
    assert!(matches!(blocks[1], AssistantContentBlock::Unsupported));
    assert!(matches!(blocks[2], AssistantContentBlock::Unsupported));

    let content = message_content(Some(&serde_json::json!({
        "content": [{"type": "futureBlock", "value": "do not expose"}]
    })));
    assert!(matches!(content.parts[0], ContentPart::Unsupported));
}

#[test]
fn canonical_tool_arguments_are_sorted_and_serde_escaped() {
    let first: Value =
        serde_json::from_str(r#"{"z":"é","a":{"quote":"\\\"","items":[null,true,2]}}"#)
            .expect("JSON");
    let second: Value =
        serde_json::from_str(r#"{"a":{"items":[null,true,2],"quote":"\\\""},"z":"é"}"#)
            .expect("JSON");
    assert_eq!(canonical_json(&first), canonical_json(&second));
    assert_eq!(
        canonical_json(&first),
        r#"{"a":{"items":[null,true,2],"quote":"\\\""},"z":"é"}"#
    );
}

#[test]
fn source_labels_use_matched_tool_arguments_and_visible_message_text() {
    let records = vec![
        serde_json::json!({"type":"session","id":"labels","cwd":"/tmp/project"}),
        message_record(
            "u1",
            None,
            serde_json::json!({"role":"user","content":[{"type":"text","text":"\n  Fix parser  \nsecond line"}]}),
        ),
        message_record(
            "a1",
            Some("u1"),
            serde_json::json!({
                "role":"assistant",
                "stopReason":"toolUse",
                "content":[
                    {"type":"toolCall","id":"read-1","name":"read","arguments":{"path":"src/analysis/../analysis/mod.rs"}},
                    {"type":"toolCall","id":"write-1","name":"write","arguments":{"path":"src/new.rs","content":"private body omitted"}},
                    {"type":"toolCall","id":"edit-1","name":"edit","arguments":{"path":"src/old.rs","edits":[]}},
                    {"type":"toolCall","id":"bash-1","name":"bash","arguments":{"command":" \n cargo test\t--workspace  "}},
                    {"type":"toolCall","id":"grep-1","name":"grep","arguments":{"pattern":"toolCallId"}},
                    {"type":"toolCall","id":"find-1","name":"find","arguments":{"pattern":"**/*.rs"}},
                    {"type":"toolCall","id":"read-2","name":"read","arguments":{"path":"/tmp/project/src/analysis/mod.rs"}}
                ]
            }),
        ),
        message_record(
            "r1",
            Some("a1"),
            serde_json::json!({"role":"toolResult","toolCallId":"read-1","toolName":"read","content":"ok"}),
        ),
        message_record(
            "r2",
            Some("r1"),
            serde_json::json!({"role":"toolResult","toolCallId":"write-1","toolName":"write","content":"ok"}),
        ),
        message_record(
            "r3",
            Some("r2"),
            serde_json::json!({"role":"toolResult","toolCallId":"edit-1","toolName":"edit","content":"ok"}),
        ),
        message_record(
            "r4",
            Some("r3"),
            serde_json::json!({"role":"toolResult","toolCallId":"bash-1","toolName":"bash","content":"ok"}),
        ),
        message_record(
            "r5",
            Some("r4"),
            serde_json::json!({"role":"toolResult","toolCallId":"grep-1","toolName":"grep","content":"ok"}),
        ),
        message_record(
            "r6",
            Some("r5"),
            serde_json::json!({"role":"toolResult","toolCallId":"find-1","toolName":"find","content":"ok"}),
        ),
        message_record(
            "r7",
            Some("r6"),
            serde_json::json!({"role":"toolResult","toolCallId":"read-2","toolName":"read","content":"ok"}),
        ),
        message_record(
            "a2",
            Some("r7"),
            serde_json::json!({"role":"assistant","stopReason":"stop","content":[{"type":"text","text":" \n Completed successfully\nmore detail"}]}),
        ),
        message_record(
            "u3",
            Some("a2"),
            serde_json::json!({"role":"user","content":"next turn"}),
        ),
        message_record(
            "a3",
            Some("u3"),
            serde_json::json!({"role":"assistant","stopReason":"stop","content":"done"}),
        ),
    ];
    let session = parse_records(&records);

    assert_eq!(item_label_for_record(&session, "u1"), "User · Fix parser");
    assert_eq!(
        item_label_for_record(&session, "a1"),
        "Assistant · read, write, edit, +4 more"
    );
    assert_eq!(
        item_label_for_record(&session, "r1"),
        "Read result · src/analysis/mod.rs"
    );
    assert_eq!(
        item_label_for_record(&session, "r2"),
        "Write result · src/new.rs"
    );
    assert_eq!(
        item_label_for_record(&session, "r3"),
        "Edit result · src/old.rs"
    );
    assert_eq!(
        item_label_for_record(&session, "r4"),
        "Bash result · cargo test --workspace"
    );
    assert_eq!(
        item_label_for_record(&session, "r5"),
        "Grep result · toolCallId"
    );
    assert_eq!(
        item_label_for_record(&session, "r6"),
        "Find result · **/*.rs"
    );
    assert_eq!(
        item_label_for_record(&session, "r7"),
        item_label_for_record(&session, "r1")
    );
    assert_eq!(
        item_label_for_record(&session, "a2"),
        "Assistant · Completed successfully"
    );

    let repeated = parse_records(&records);
    assert_eq!(
        item_label_for_record(&repeated, "r1"),
        item_label_for_record(&session, "r1")
    );
    let mut appended_records = records.clone();
    appended_records.push(message_record(
        "u4",
        Some("a3"),
        serde_json::json!({"role":"user","content":"unrelated later request"}),
    ));
    let appended = parse_records(&appended_records);
    assert_eq!(
        item_label_for_record(&appended, "r1"),
        item_label_for_record(&session, "r1")
    );
    let mut reordered = session.clone();
    reordered.context_items.reverse();
    assert_eq!(
        item_label_for_record(&reordered, "r1"),
        item_label_for_record(&session, "r1")
    );
    let mut filtered = session.clone();
    filtered
        .context_items
        .retain(|item| item.source_record_id.as_deref() != Some("r1"));
    assert_eq!(
        item_label_for_record(&filtered, "r7"),
        item_label_for_record(&session, "r7")
    );
}

#[test]
fn tool_result_labels_fall_back_on_missing_wrong_ambiguous_or_mismatched_metadata() {
    let session = parse_records(&[
        serde_json::json!({"type":"session","id":"fallbacks","cwd":"/tmp/project"}),
        message_record(
            "u1",
            None,
            serde_json::json!({"role":"user","content":"start"}),
        ),
        message_record(
            "a1",
            Some("u1"),
            serde_json::json!({
                "role":"assistant",
                "stopReason":"toolUse",
                "content":[
                    {"type":"toolCall","id":"wrong-args","name":"read","arguments":{"path":12}},
                    {"type":"toolCall","id":"unknown","name":"customSearch","arguments":{"query":"private"}},
                    {"type":"toolCall","id":"duplicate","name":"read","arguments":{"path":"first.rs"}},
                    {"type":"toolCall","id":"duplicate","name":"read","arguments":{"path":"second.rs"}},
                    {"type":"toolCall","id":"mismatch","name":"read","arguments":{"path":"secret.rs"}},
                    {"type":"toolCall","id":"known","name":"read","arguments":{"path":"src/known.rs"}},
                    {"type":"toolCall","id":"no-command","name":"bash","arguments":{"timeout":2}}
                ]
            }),
        ),
        message_record(
            "r1",
            Some("a1"),
            serde_json::json!({"role":"toolResult","toolCallId":"wrong-args","toolName":"read","content":"ok"}),
        ),
        message_record(
            "r2",
            Some("r1"),
            serde_json::json!({"role":"toolResult","toolCallId":"unknown","toolName":"customSearch","content":"ok"}),
        ),
        message_record(
            "r3",
            Some("r2"),
            serde_json::json!({"role":"toolResult","toolCallId":"duplicate","toolName":"read","content":"ok"}),
        ),
        message_record(
            "r4",
            Some("r3"),
            serde_json::json!({"role":"toolResult","toolName":"bash","content":"ok"}),
        ),
        message_record(
            "r5",
            Some("r4"),
            serde_json::json!({"role":"toolResult","toolCallId":"mismatch","toolName":"write","content":"ok"}),
        ),
        message_record(
            "r6",
            Some("r5"),
            serde_json::json!({"role":"toolResult","toolCallId":"known","content":"ok"}),
        ),
        message_record(
            "r7",
            Some("r6"),
            serde_json::json!({"role":"toolResult","toolCallId":"no-command","toolName":"bash","content":"ok"}),
        ),
        message_record(
            "a2",
            Some("r7"),
            serde_json::json!({"role":"assistant","stopReason":"stop","content":"done"}),
        ),
    ]);

    assert_eq!(item_label_for_record(&session, "r1"), "Read result");
    assert_eq!(item_label_for_record(&session, "r2"), "customSearch result");
    assert_eq!(item_label_for_record(&session, "r3"), "Read result");
    assert_eq!(item_label_for_record(&session, "r4"), "Bash result");
    assert_eq!(item_label_for_record(&session, "r5"), "Write result");
    assert_eq!(
        item_label_for_record(&session, "r6"),
        "Read result · src/known.rs"
    );
    assert_eq!(item_label_for_record(&session, "r7"), "Bash result");
}

#[test]
fn tool_matching_is_scoped_to_the_selected_branch() {
    let session = parse_records(&[
        serde_json::json!({"type":"session","id":"branches","cwd":"/tmp/project"}),
        message_record(
            "u1",
            None,
            serde_json::json!({"role":"user","content":"start"}),
        ),
        message_record(
            "a-left",
            Some("u1"),
            serde_json::json!({"role":"assistant","stopReason":"toolUse","content":[{"type":"toolCall","id":"shared","name":"read","arguments":{"path":"left.rs"}}]}),
        ),
        message_record(
            "r-left",
            Some("a-left"),
            serde_json::json!({"role":"toolResult","toolCallId":"shared","toolName":"read","content":"left"}),
        ),
        message_record(
            "a-right",
            Some("u1"),
            serde_json::json!({"role":"assistant","stopReason":"toolUse","content":[{"type":"toolCall","id":"shared","name":"read","arguments":{"path":"right.rs"}}]}),
        ),
        message_record(
            "r-right",
            Some("a-right"),
            serde_json::json!({"role":"toolResult","toolCallId":"shared","toolName":"read","content":"right"}),
        ),
        message_record(
            "a-end",
            Some("r-right"),
            serde_json::json!({"role":"assistant","stopReason":"stop","content":"done"}),
        ),
    ]);

    assert_eq!(
        item_label_for_record(&session, "r-right"),
        "Read result · right.rs"
    );
    assert!(!session
        .context_items
        .iter()
        .any(|item| { item.source_record_id.as_deref() == Some("r-left") }));
}

#[test]
fn message_fallbacks_cover_images_and_unavailable_content() {
    let session = parse_records(&[
        serde_json::json!({"type":"session","id":"message-fallbacks"}),
        message_record(
            "u-image",
            None,
            serde_json::json!({"role":"user","content":[{"type":"image","data":"AA==","mimeType":"image/png"}]}),
        ),
        message_record(
            "a-image",
            Some("u-image"),
            serde_json::json!({"role":"assistant","stopReason":"stop","content":[{"type":"image","data":"AA==","mimeType":"image/png"}]}),
        ),
        message_record(
            "u-missing",
            Some("a-image"),
            serde_json::json!({"role":"user"}),
        ),
        message_record(
            "a-missing",
            Some("u-missing"),
            serde_json::json!({"role":"assistant","stopReason":"stop"}),
        ),
        message_record(
            "u-text",
            Some("a-missing"),
            serde_json::json!({"role":"user","content":"continued"}),
        ),
        message_record(
            "a-end",
            Some("u-text"),
            serde_json::json!({"role":"assistant","stopReason":"stop","content":"done"}),
        ),
    ]);

    assert_eq!(item_label_for_record(&session, "u-image"), "User · Image");
    assert_eq!(
        item_label_for_record(&session, "a-image"),
        "Assistant · Image"
    );
    assert_eq!(item_label_for_record(&session, "u-missing"), "User message");
    assert_eq!(
        item_label_for_record(&session, "a-missing"),
        "Assistant response"
    );
}

#[test]
fn other_context_kinds_keep_explicit_kind_specific_labels() {
    let invocations = HashMap::<&str, Vec<ToolInvocation<'_>>>::new();
    let assistant_with_text_and_tool = serde_json::json!({
        "content": [
            {"type":"text","text":"  Visible answer\nignored suffix"},
            {"type":"toolCall","id":"tool-1","name":"read","arguments":{"path":"private.rs"}}
        ]
    });
    assert_eq!(
        item_label(
            ContextItemKind::AssistantMessage,
            Some(&assistant_with_text_and_tool),
            &invocations,
            None,
        ),
        "Assistant · Visible answer"
    );
    for (kind, expected) in [
        (ContextItemKind::System, "System context"),
        (ContextItemKind::ToolDefinition, "Tool definition"),
        (ContextItemKind::CustomMessage, "Custom context message"),
        (ContextItemKind::BranchSummary, "Branch summary"),
        (ContextItemKind::CompactionSummary, "Compaction summary"),
        (ContextItemKind::Other, "Context item"),
    ] {
        assert_eq!(item_label(kind, None, &invocations, None), expected);
    }
}

#[test]
fn label_normalization_is_safe_unicode_aware_and_bounded() {
    assert_eq!(
        bounded_label("  Résumé\t parser\u{0007}\u{202e} status\n "),
        "Résumé parser status"
    );
    let long = bounded_label(&format!("Read · {}", "📦".repeat(200)));
    assert_eq!(long.chars().count(), MAX_LABEL_CHARS);
    assert!(long.ends_with('…'));
    assert!(bounded_label(&"😀".repeat(MAX_LABEL_CHARS)).chars().count() <= MAX_LABEL_CHARS);
}

#[test]
fn file_labels_are_lexically_relative_only_inside_the_session_directory() {
    let cwd = Some("/tmp/project");
    assert_eq!(
        display_path_argument("src/../src/main.rs", cwd),
        "src/main.rs"
    );
    assert_eq!(
        display_path_argument("/tmp/project/src/main.rs", cwd),
        "src/main.rs"
    );
    assert_eq!(display_path_argument("/tmp/project", cwd), ".");
    assert_eq!(
        display_path_argument("../../etc/passwd", cwd),
        "../../etc/passwd"
    );
    assert_eq!(display_path_argument("/etc/passwd", cwd), "/etc/passwd");
    assert_eq!(
        display_path_argument("/tmp/project2/secret.txt", cwd),
        "/tmp/project2/secret.txt"
    );
    assert_eq!(display_path_argument("src/main.rs", None), "src/main.rs");
    assert_eq!(
        display_path_argument(r"C:\outside\secret.txt", cwd),
        "C:/outside/secret.txt"
    );
}

#[test]
fn malformed_parent_is_reported_by_adapter() {
    let file = File::open("fixtures/pi/malformed-parent.jsonl").expect("fixture");
    let error = PiSourceAdapter
        .parse(&mut BufReader::new(file))
        .expect_err("must fail");
    assert!(error.to_string().contains("broken parent link"));
    assert!(matches!(error, SourceError::InvalidStructure(_)));
}

#[test]
fn compaction_summary_is_required_but_explicit_empty_is_supported() {
    for summary in [
        None,
        Some(serde_json::Value::Null),
        Some(serde_json::json!(12)),
    ] {
        let mut compaction = serde_json::json!({
            "type": "compaction",
            "id": "c1",
            "parentId": "a1",
            "firstKeptEntryId": "a1",
        });
        if let Some(summary) = summary {
            compaction["summary"] = summary;
        }
        let records = [
            serde_json::json!({"type":"session","id":"summary-required"}),
            message_record(
                "u1",
                None,
                serde_json::json!({"role":"user","content":"start"}),
            ),
            message_record(
                "a1",
                Some("u1"),
                serde_json::json!({"role":"assistant","stopReason":"stop","content":"done"}),
            ),
            compaction,
        ];
        let jsonl = records
            .iter()
            .map(|record| serde_json::to_string(record).expect("JSON record"))
            .collect::<Vec<_>>()
            .join("\n");
        let error = PiSourceAdapter
            .parse(&mut Cursor::new(jsonl))
            .expect_err("missing or invalid summary must fail");
        assert!(matches!(error, SourceError::RequiredField { .. }));
    }

    let session = parse_records(&[
        serde_json::json!({"type":"session","id":"empty-summary"}),
        message_record(
            "u1",
            None,
            serde_json::json!({"role":"user","content":"start"}),
        ),
        message_record(
            "a1",
            Some("u1"),
            serde_json::json!({"role":"assistant","stopReason":"stop","content":"done"}),
        ),
        serde_json::json!({
            "type":"compaction",
            "id":"c1",
            "parentId":"a1",
            "summary":"",
            "firstKeptEntryId":"a1"
        }),
    ]);
    let summary = session
        .context_items
        .iter()
        .find(|item| item.kind == ContextItemKind::CompactionSummary)
        .expect("summary item");
    assert!(matches!(
        summary.payload,
        TokenizationPayload::CompactionSummary(ref text) if text.is_empty()
    ));
}

#[test]
fn selected_source_usage_above_safe_integer_is_rejected() {
    let records = [
        serde_json::json!({"type":"session","id":"numeric"}),
        message_record(
            "u1",
            None,
            serde_json::json!({"role":"user","content":"start"}),
        ),
        message_record(
            "a1",
            Some("u1"),
            serde_json::json!({
                "role":"assistant",
                "stopReason":"stop",
                "content":"done",
                "usage":{"input":9007199254740992u64}
            }),
        ),
    ];
    let jsonl = records
        .iter()
        .map(|record| serde_json::to_string(record).expect("JSON record"))
        .collect::<Vec<_>>()
        .join("\n");
    let error = PiSourceAdapter
        .parse(&mut Cursor::new(jsonl))
        .expect_err("unsafe usage must fail");
    assert!(matches!(
        error,
        SourceError::UnsafeInteger {
            field: "usage.input"
        }
    ));
}

#[test]
fn claude_thinking_is_a_reported_item_that_follows_the_models_retention() {
    let session = |model: &str| {
        let assistant = |id: &str, parent: &str| {
            serde_json::json!({"type": "message", "id": id, "parentId": parent, "message": {
                "role": "assistant", "provider": "github-copilot", "model": model, "api": "anthropic-messages",
                "stopReason": "stop",
                "content": [{"type": "thinking", "thinking": "A short summary."}, {"type": "text", "text": "Answer."}],
                "usage": {"input": 10, "output": 50, "cacheRead": 0, "cacheWrite": 0, "reasoning": 40}}})
        };
        let user = |id: &str, parent: Option<&str>| {
            serde_json::json!({"type": "message", "id": id, "parentId": parent, "message": {
                "role": "user", "content": [{"type": "text", "text": "Question."}]}})
        };
        parse_records(&[
            serde_json::json!({"type": "session", "version": 3, "id": "thinking", "timestamp": "2026-10-01T00:00:00Z", "cwd": "/tmp"}),
            user("u1", None),
            assistant("a1", "u1"),
            user("u2", Some("a1")),
            assistant("a2", "u2"),
        ])
    };
    let thinking_in_second_call = |session: &NormalizedSession| {
        session.model_calls[1]
            .context_item_ids
            .iter()
            .any(|id| id.ends_with(":thinking"))
    };
    // Opus 5.5 keeps earlier thinking; Sonnet 4.5 drops it at the next user message.
    let keeps = session("claude-opus-5.5");
    assert!(thinking_in_second_call(&keeps));
    let thinking = keeps
        .context_items
        .iter()
        .find(|item| item.kind == ContextItemKind::Thinking)
        .expect("thinking item");
    assert!(matches!(
        thinking.payload,
        TokenizationPayload::ReportedThinking { tokens: 40, .. }
    ));
    assert!(keeps.context_items.iter().any(|item| matches!(
        item.payload,
        TokenizationPayload::AssistantMessage {
            thinking_reported: true,
            ..
        }
    )));
    assert!(!thinking_in_second_call(&session("claude-sonnet-4.5")));
    // Not a Claude model: no thinking item.
    assert!(!session("gpt-6-sol")
        .context_items
        .iter()
        .any(|item| item.kind == ContextItemKind::Thinking));
}
