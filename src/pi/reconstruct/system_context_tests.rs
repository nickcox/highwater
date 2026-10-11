use super::*;
use serde_json::json;
use std::io::Cursor;
fn session(messages: Vec<Value>) -> NormalizedSession {
    let mut lines = vec![json!({"type":"session","id":"system-test","version":3}).to_string()];
    let mut parent: Option<String> = None;
    for (i, mut value) in messages.into_iter().enumerate() {
        let id = format!("r{i}");
        value["id"] = json!(id);
        value["parentId"] = json!(parent);
        parent = Some(id);
        lines.push(value.to_string());
    }
    PiSourceAdapter
        .parse(&mut Cursor::new(lines.join("\n")))
        .expect("session")
}
fn sys(value: Value) -> Value {
    json!({"type":"message", "message":value})
}
fn call() -> Value {
    sys(
        json!({"role":"assistant","content":[{"type":"text","text":"answer"}],"provider":"openai","model":"gpt-4o","api":"openai-completions","stopReason":"stop","usage":{"input":200,"output":3,"cacheRead":20,"cacheWrite":0}}),
    )
}
fn system(text: &str) -> Value {
    sys(json!({"role":"system","content":text}))
}
fn tool(name: &str, description: &str) -> Value {
    json!({"name":name,"description":description,"parameters":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"],"additionalProperties":false}})
}
fn text_at(s: &NormalizedSession, call: usize) -> &str {
    let item = s
        .context_items
        .iter()
        .find(|i| {
            i.kind == ContextItemKind::System
                && s.model_calls[call].context_item_ids.contains(&i.id)
        })
        .expect("system");
    match &item.payload {
        TokenizationPayload::SystemPrompt { text, .. } => text,
        _ => panic!("prompt payload"),
    }
}
#[test]
fn source_section_order_and_patch_reinsertion_match_javascript() {
    let lines = [r#"{"type":"session","id":"ordered"}"#.to_owned(),
        r#"{"type":"message","id":"s","parentId":null,"message":{"role":"system","content":"","sections":{"z":"Z","a":"A","2":"Two","1":"One"}}}"#.to_owned(),
        { let mut c=call(); c["id"]=json!("c1");c["parentId"]=json!("s");c.to_string() },
        r#"{"type":"message","id":"drop","parentId":"c1","message":{"role":"system","content":"","sections":{"z":null,"1":null}}}"#.to_owned(),
        r#"{"type":"message","id":"add","parentId":"drop","message":{"role":"system","content":"","sections":{"z":"Z","1":"One"}}}"#.to_owned(),
        { let mut c=call(); c["id"]=json!("c2");c["parentId"]=json!("add");c.to_string() }];
    let s = PiSourceAdapter
        .parse(&mut Cursor::new(lines.join("\n")))
        .unwrap();
    assert_eq!(text_at(&s, 0), "One\n\nTwo\n\nZ\n\nA");
    assert_eq!(text_at(&s, 1), "One\n\nTwo\n\nA\n\nZ");
}
#[test]
fn recorded_declarations_are_estimated_nonzero_and_provider_accounting_stays_independent() {
    use crate::analysis::{analyze, AnalysisConfig, TokenizationPolicy};
    let s = PiSourceAdapter
        .parse_path_with_stats(Path::new("fixtures/pi/system-context.jsonl"))
        .unwrap()
        .0;
    assert!(text_at(&s, 0).starts_with("You are a coding assistant."));
    let original = s
        .model_calls
        .iter()
        .map(|c| c.reported_usage.input)
        .collect::<Vec<_>>();
    for policy in [
        TokenizationPolicy::Auto,
        TokenizationPolicy::Strict,
        TokenizationPolicy::Heuristic,
    ] {
        let a = analyze(
            s.clone(),
            AnalysisConfig {
                tokenization: policy,
                perf_diagnostics: false,
            },
        )
        .unwrap();
        for kind in ["system", "toolDefinition"] {
            let items = a
                .context_items
                .iter()
                .filter(|i| i.kind == kind)
                .collect::<Vec<_>>();
            assert!(!items.is_empty());
            assert!(items.iter().all(|i| i.token_estimates.iter().all(|e| e
                .tokens
                .is_some_and(|t| t > 0)
                && e.coverage == "partial"
                && e.note_codes
                    .contains(&"estimatedProviderSerialization".to_owned()))));
        }
        assert_eq!(
            a.model_calls
                .iter()
                .map(|c| c.usage.input)
                .collect::<Vec<_>>(),
            original
        );
    }
}
#[test]
fn sections_and_tool_revisions_are_immutable_and_noops_keep_identity() {
    let s = session(vec![
        sys(
            json!({"role":"system","content":"","sections":{"intro":"Base instructions"},"toolsAdded":[tool("read","Read a file")]}),
        ),
        call(),
        sys(
            json!({"role":"system","content":"","sections":{"intro":"New instructions"},"toolsAdded":[tool("read","Read safely")]}),
        ),
        call(),
        sys(
            json!({"role":"system","content":"","sections":{"intro":"New instructions"},"toolsAdded":[tool("read","Read safely")]}),
        ),
        call(),
    ]);
    assert_eq!(text_at(&s, 0), "Base instructions");
    assert_eq!(text_at(&s, 1), "New instructions");
    let globals = |n: usize| {
        s.model_calls[n]
            .context_item_ids
            .iter()
            .filter(|id| {
                s.context_items.iter().any(|i| {
                    &i.id == *id
                        && matches!(
                            i.kind,
                            ContextItemKind::System | ContextItemKind::ToolDefinition
                        )
                })
            })
            .cloned()
            .collect::<Vec<_>>()
    };
    assert_ne!(globals(0), globals(1));
    assert_eq!(globals(1), globals(2));
    assert_eq!(
        s.context_items
            .iter()
            .filter(|i| i.kind == ContextItemKind::ToolDefinition)
            .count(),
        2
    );
    assert!(s.model_calls.iter().all(|c| c.tool_loadout_known));
}
#[test]
fn checkpoints_preserve_identity_and_never_summarize_global_context() {
    let head = json!({"role":"system","content":"Base","toolsAdded":[tool("read","Read")]});
    let s = session(vec![
        sys(head.clone()),
        sys(json!({"role":"user","content":"hello"})),
        call(),
        json!({"type":"compaction","summary":"Summary","firstKeptEntryId":"r3","systemMessage":head}),
        call(),
    ]);
    for id in &s.model_calls[0].context_item_ids[..2] {
        assert!(s.model_calls[1].context_item_ids.contains(id));
        assert!(!s.compactions[0].source_item_ids.contains(id));
        assert!(s.compactions[0].retained_item_ids.contains(id));
        assert!(!s.lineage.iter().any(|e| &e.from == id));
    }
    assert_eq!(text_at(&s, 1), "Base");
    assert_eq!(
        s.model_calls[0].reported_usage.input,
        s.model_calls[1].reported_usage.input
    );
}
#[test]
fn checkpoint_replaces_not_appends_and_later_deltas_append_once() {
    let s = session(vec![
        system("old"),
        call(),
        json!({"type":"compaction","summary":"S","firstKeptEntryId":"r2","systemMessage":{"role":"system","content":"checkpoint"}}),
        system("later"),
        call(),
    ]);
    assert_eq!(text_at(&s, 0), "old");
    assert_eq!(text_at(&s, 1), "checkpoint\n\nlater");
    assert!(s.model_calls[1].tool_loadout_known);
}
#[test]
fn removed_then_readded_tools_get_new_revisions_in_runtime_order() {
    let s = session(vec![
        sys(json!({"role":"system","content":"base","toolsAdded":[tool("a","A"),tool("b","B")]})),
        call(),
        sys(
            json!({"role":"system","content":"","toolsRemoved":[{"name":"a"}],"toolsAdded":[tool("a","A")]}),
        ),
        call(),
    ]);
    let names = |n: usize| {
        s.model_calls[n]
            .context_item_ids
            .iter()
            .filter_map(|id| {
                s.context_items
                    .iter()
                    .find(|i| &i.id == id)?
                    .metadata
                    .get("toolName")
                    .cloned()
            })
            .collect::<Vec<_>>()
    };
    assert_eq!(names(0), vec!["a", "b"]);
    assert_eq!(names(1), vec!["b", "a"]);
    assert_ne!(
        s.model_calls[0].context_item_ids[1],
        s.model_calls[1].context_item_ids[2]
    );
    assert_eq!(
        s.model_calls[0].context_item_ids[0],
        s.model_calls[1].context_item_ids[0]
    );
}
#[test]
fn replacement_discrepancy_and_malformed_sections_are_unknown_until_checkpoint() {
    for patch in [
        json!({"role":"system","content":"new","replace":true}),
        json!({"role":"system","content":"","sections":{"bad":42}}),
    ] {
        let s = session(vec![
            system("old"),
            call(),
            sys(patch),
            call(),
            json!({"type":"compaction","summary":"S","firstKeptEntryId":"r4","systemMessage":{"role":"system","content":"verified"}}),
            call(),
        ]);
        let prompt = s
            .context_items
            .iter()
            .find(|i| {
                i.kind == ContextItemKind::System
                    && s.model_calls[1].context_item_ids.contains(&i.id)
            })
            .unwrap();
        assert!(matches!(
            prompt.payload,
            TokenizationPayload::SystemPrompt {
                complete: false,
                ..
            }
        ));
        assert_eq!(text_at(&s, 2), "verified");
        assert!(s
            .context_items
            .iter()
            .any(|i| s.model_calls[2].context_item_ids.contains(&i.id)
                && matches!(
                    i.payload,
                    TokenizationPayload::SystemPrompt { complete: true, .. }
                )));
    }
}
#[test]
fn empty_is_known_zero_and_missing_history_is_not_fabricated() {
    let s = session(vec![
        call(),
        sys(json!({"role":"system","content":"","toolsAdded":[]})),
        call(),
    ]);
    assert!(s.model_calls[0].context_item_ids.is_empty());
    assert!(!s.model_calls[0].tool_loadout_known);
    assert_eq!(text_at(&s, 1), "");
    assert!(s.model_calls[1].tool_loadout_known);
}
#[test]
fn explicit_empty_loadout_suppresses_missing_diagnostic_without_a_fake_tool_item() {
    use crate::analysis::{analyze, AnalysisConfig, TokenizationPolicy};
    let s = session(vec![
        sys(json!({"role":"system","content":"","toolsAdded":[]})),
        call(),
    ]);
    let a = analyze(
        s,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Auto,
            perf_diagnostics: false,
        },
    )
    .unwrap();
    assert_eq!(a.context_items.len(), 1);
    assert_eq!(a.context_items[0].token_estimates[0].tokens, Some(0));
    assert!(!a.model_calls[0]
        .token_analysis
        .explanation_codes
        .contains(&"missingToolDefinitions".to_owned()));
}
#[test]
fn legacy_tools_are_retained_without_lineage_and_modern_baseline_supersedes_them() {
    let s = session(vec![
        sys(json!({"role":"toolDefinition","content":"Legacy schema"})),
        call(),
        json!({"type":"compaction","summary":"S","firstKeptEntryId":"r2"}),
        call(),
        sys(json!({"role":"system","content":"base","toolsAdded":[tool("read","Read")]})),
        call(),
    ]);
    let legacy = s
        .context_items
        .iter()
        .find(|i| matches!(i.payload, TokenizationPayload::CustomMessage(_)))
        .unwrap();
    assert!(s.model_calls[1].context_item_ids.contains(&legacy.id));
    assert!(!s.model_calls[2].context_item_ids.contains(&legacy.id));
    assert!(!s.lineage.iter().any(|edge| edge.from == legacy.id));
}
#[test]
fn loadout_completeness_tracks_active_tools_across_noops_and_recovery() {
    use crate::analysis::{analyze, AnalysisConfig, TokenizationPolicy};
    for repair in [
        json!({"role":"system","content":"","toolsRemoved":[{"name":"broken"}]}),
        json!({"role":"system","content":"","toolsAdded":[tool("broken", "Fixed")]}),
    ] {
        let s = session(vec![
            sys(
                json!({"role":"system","content":"base","toolsAdded":[{"name":"broken","description":42,"parameters":null}]}),
            ),
            call(),
            sys(json!({"role":"system","content":"","toolsAdded":[]})),
            call(),
            sys(json!({"role":"system","content":"","toolsAdded":[tool("read", "Read")]})),
            call(),
            sys(repair),
            call(),
        ]);
        assert_eq!(
            s.model_calls
                .iter()
                .map(|c| c.tool_loadout_known)
                .collect::<Vec<_>>(),
            [false, false, false, true],
        );
        let a = analyze(
            s,
            AnalysisConfig {
                tokenization: TokenizationPolicy::Auto,
                perf_diagnostics: false,
            },
        )
        .unwrap();
        for (index, c) in a.model_calls.iter().enumerate() {
            assert_eq!(
                c.token_analysis
                    .explanation_codes
                    .contains(&"missingToolDefinitions".to_owned()),
                index < 3
            );
        }
    }
}

#[test]
fn removing_the_last_invalid_tool_recovers_a_known_empty_loadout() {
    let s = session(vec![
        sys(json!({"role":"system","content":"base","toolsAdded":[{"name":"broken"}]})),
        call(),
        sys(json!({"role":"system","content":"","toolsRemoved":[{"name":"broken"}]})),
        call(),
    ]);
    assert!(!s.model_calls[0].tool_loadout_known);
    assert!(s.model_calls[1].tool_loadout_known);
    assert!(s.model_calls[1].context_item_ids.iter().all(|id| s
        .context_items
        .iter()
        .find(|i| &i.id == id)
        .unwrap()
        .kind
        != ContextItemKind::ToolDefinition));
}

#[test]
fn changed_checkpoints_retain_only_unchanged_global_revisions() {
    let s = session(vec![
        sys(
            json!({"role":"system","content":"old","toolsAdded":[tool("read","Old"),tool("keep","Keep"),tool("remove","Remove")]}),
        ),
        sys(json!({"role":"user","content":"retained conversation"})),
        call(),
        json!({"type":"compaction","summary":"S","firstKeptEntryId":"r1","systemMessage":{"role":"system","content":"new","toolsAdded":[tool("read","Changed"),tool("keep","Keep"),tool("write","New")]}}),
        call(),
    ]);
    let event = &s.compactions[0];
    for item in &s.context_items {
        if matches!(
            item.kind,
            ContextItemKind::System | ContextItemKind::ToolDefinition
        ) {
            assert!(!event.source_item_ids.contains(&item.id));
            assert!(!s.lineage.iter().any(|edge| edge.from == item.id));
            let unchanged = s.model_calls[0].context_item_ids.contains(&item.id)
                && s.model_calls[1].context_item_ids.contains(&item.id);
            assert_eq!(event.retained_item_ids.contains(&item.id), unchanged);
            if unchanged {
                assert_eq!(
                    item.metadata.get("toolName").map(String::as_str),
                    Some("keep")
                );
                assert_eq!(item.presence.len(), 1);
                assert_eq!(item.first_model_call, 1);
                assert_eq!(item.last_model_call, 2);
            }
        }
    }
    let user = s
        .context_items
        .iter()
        .find(|i| i.kind == ContextItemKind::UserMessage)
        .unwrap();
    assert!(event.retained_item_ids.contains(&user.id));
    assert_eq!(text_at(&s, 0), "old");
    assert_eq!(text_at(&s, 1), "new");
}

#[test]
fn malformed_tool_declaration_does_not_become_a_known_zero() {
    let s = session(vec![
        sys(
            json!({"role":"system","content":"base","toolsAdded":[{"name":"broken","description":42,"parameters":null}]}),
        ),
        call(),
    ]);
    assert!(!s.model_calls[0].tool_loadout_known);
    assert!(s.context_items.iter().any(|i| matches!(
        i.payload,
        TokenizationPayload::ToolDefinition {
            complete: false,
            ..
        }
    )));
}
#[test]
fn older_compaction_preserves_only_observed_global_state_and_terminal_calls_stay_absent() {
    let s = session(vec![
        system("Observed"),
        call(),
        json!({"type":"compaction","summary":"S","firstKeptEntryId":"r2"}),
        call(),
        json!({"type":"compaction","summary":"Terminal","firstKeptEntryId":"r4"}),
    ]);
    assert_eq!(s.model_calls.len(), 2);
    assert_eq!(text_at(&s, 1), "Observed");
    assert_eq!(
        s.context_items
            .iter()
            .filter(|i| i.kind == ContextItemKind::System)
            .count(),
        1
    );
    assert!(s
        .compactions
        .iter()
        .all(|c| c.source_item_ids.iter().all(|id| s
            .context_items
            .iter()
            .find(|i| &i.id == id)
            .unwrap()
            .kind
            != ContextItemKind::System)));
}
#[test]
fn selected_branch_excludes_sibling_prompt_updates() {
    let records = [
        json!({"type":"session","id":"s"}),
        json!({"type":"message","id":"root","parentId":null,"message":{"role":"system","content":"root"}}),
        json!({"type":"message","id":"sibling","parentId":"root","message":{"role":"system","content":"wrong"}}),
        json!({"type":"message","id":"selected","parentId":"root","message":{"role":"system","content":"right"}}),
        {
            let mut c = call();
            c["id"] = json!("answer");
            c["parentId"] = json!("selected");
            c
        },
    ];
    let s = PiSourceAdapter
        .parse(&mut Cursor::new(
            records
                .iter()
                .map(Value::to_string)
                .collect::<Vec<_>>()
                .join("\n"),
        ))
        .unwrap();
    assert_eq!(text_at(&s, 0), "root\n\nright");
}
