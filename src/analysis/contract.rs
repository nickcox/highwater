//! Live producer for the TypeScript contract suite. Always exercises Rust boundary
//! checks; only exports when the orchestrator supplies a fresh temporary directory.

use super::{
    test_support::{analysis_with_controlled_estimates, fake_session},
    *,
};
use crate::pi::PiSourceAdapter;
use std::{fs, io::Cursor, path::PathBuf};

fn config(policy: TokenizationPolicy) -> AnalysisConfig {
    AnalysisConfig {
        tokenization: policy,
        perf_diagnostics: false,
        claude_code_billing: Default::default(),
    }
}
fn push(
    cases: &mut Vec<(String, Analysis)>,
    name: &str,
    session: NormalizedSession,
    policy: TokenizationPolicy,
) {
    cases.push((
        name.into(),
        analyze(session, config(policy)).expect("successful Rust contract input"),
    ));
}
fn economics_session(usage: ReportedUsage) -> NormalizedSession {
    let mut session = fake_session();
    session.source = SourceDescriptor {
        kind: "pi".into(),
        version: "0.78.0".into(),
        cost_basis: CostBasis::PiModelRates,
    };
    session.model_calls[0].target = ModelTarget {
        provider: Some("anthropic".into()),
        model: Some("claude-sonnet-4-6".into()),
        api: Some("anthropic-messages".into()),
    };
    session.model_calls[0].reported_usage = usage;
    session
}
fn two_items() -> NormalizedSession {
    let mut session = fake_session();
    let mut item = session.context_items[0].clone();
    item.id = "second-item".into();
    item.payload = TokenizationPayload::UserMessage(MessageContent::text("distinct payload"));
    session.model_calls[0]
        .context_item_ids
        .push(item.id.clone());
    session.context_items.push(item);
    session
}
fn terminal_session() -> NormalizedSession {
    let mut session = fake_session();
    let item = &mut session.context_items[0];
    item.kind = ContextItemKind::CompactionSummary;
    item.payload = TokenizationPayload::CompactionSummary(String::new());
    item.presence.clear();
    item.first_model_call = 0;
    item.last_model_call = 0;
    session.model_calls.clear();
    session.compactions.push(NormalizedCompaction {
        id: "compaction".into(),
        before_model_call: 1,
        source_item_ids: Vec::new(),
        retained_item_ids: Vec::new(),
        summary_item_id: item.id.clone(),
        tokens_before: None,
    });
    session
}

fn assert_safe_raw_integers(value: &serde_json::Value) {
    match value {
        serde_json::Value::Number(number) if number.is_u64() => {
            assert!(number.as_u64().expect("u64") <= MAX_SAFE_JSON_INTEGER)
        }
        serde_json::Value::Number(number) if number.is_i64() => {
            assert!(number.as_i64().expect("i64").unsigned_abs() <= MAX_SAFE_JSON_INTEGER)
        }
        serde_json::Value::Array(values) => values.iter().for_each(assert_safe_raw_integers),
        serde_json::Value::Object(values) => values.values().for_each(assert_safe_raw_integers),
        _ => {} // Continuous costs/ratios have separate finite-number validation.
    }
}

#[test]
fn export_live_contract() {
    let mut cases = Vec::new();
    for fixture in [
        "aborted-assistant",
        "branch",
        "compaction-metadata",
        "compaction",
        "context-entry-kinds",
        "economics-policies",
        "copilot-economics",
        "errored-assistant",
        "failed-usage",
        "failed-tool",
        "multiple-compactions",
        "simple",
        "system-context",
        "terminal-compaction",
        "tools",
    ] {
        for policy in [
            TokenizationPolicy::Auto,
            TokenizationPolicy::Strict,
            TokenizationPolicy::Heuristic,
            TokenizationPolicy::Off,
        ] {
            let session = PiSourceAdapter
                .parse_path_with_stats(&PathBuf::from(format!("fixtures/pi/{fixture}.jsonl")))
                .expect("fixture")
                .0;
            push(
                &mut cases,
                &format!("fixture-{fixture}-{}", policy.as_str()),
                session,
                policy,
            );
        }
    }
    for (name, target) in [
        ("identity-absent", ModelTarget::default()),
        (
            "identity-literal-unknown",
            ModelTarget {
                provider: Some("unknown".into()),
                model: Some("unknown".into()),
                api: Some("unknown".into()),
            },
        ),
        (
            "identity-delimiter-left",
            ModelTarget {
                provider: Some("p|model=m".into()),
                model: Some("x".into()),
                api: None,
            },
        ),
        (
            "identity-delimiter-right",
            ModelTarget {
                provider: Some("p".into()),
                model: Some("m|model=x".into()),
                api: None,
            },
        ),
    ] {
        let mut session = fake_session();
        session.model_calls[0].target = target;
        push(&mut cases, name, session, TokenizationPolicy::Heuristic);
    }
    for api in [
        "openai-codex-responses",
        "openai-responses",
        "openai-completions",
        "anthropic-messages",
        "google-generative-ai",
        "google-vertex",
        "azure-openai-responses",
        "bedrock-converse-stream",
        "pi-messages",
    ] {
        let mut session = fake_session();
        session.source.kind = "pi".into();
        let call = &mut session.model_calls[0];
        call.target.api = Some(api.into());
        call.stop_reason = Some("stop".into());
        call.timestamps = CallTimestamps {
            started_at_ms: Some(1700000000000),
            recorded_at_ms: Some(1700000002000),
        };
        call.reported_usage.output = Some(100);
        call.reported_usage.reasoning = Some(80);
        push(
            &mut cases,
            &format!("timing-{api}"),
            session,
            TokenizationPolicy::Heuristic,
        );
    }
    for (name, api, reason, start, end, output) in [
        (
            "timing-missing",
            "openai-responses",
            "stop",
            None,
            None,
            Some(100),
        ),
        (
            "timing-zero-interval",
            "openai-responses",
            "stop",
            Some(10),
            Some(10),
            Some(100),
        ),
        (
            "timing-reversed",
            "openai-responses",
            "stop",
            Some(11),
            Some(10),
            Some(100),
        ),
        (
            "timing-unknown-api",
            "custom-api",
            "stop",
            Some(10),
            Some(2010),
            Some(100),
        ),
        (
            "timing-error",
            "openai-responses",
            "error",
            Some(10),
            Some(2010),
            Some(100),
        ),
        (
            "timing-aborted",
            "openai-responses",
            "aborted",
            Some(10),
            Some(2010),
            Some(100),
        ),
        (
            "timing-unknown-output",
            "openai-responses",
            "stop",
            Some(10),
            Some(2010),
            None,
        ),
        (
            "timing-zero-output",
            "openai-responses",
            "stop",
            Some(0),
            Some(2000),
            Some(0),
        ),
        (
            "timing-unsafe",
            "openai-responses",
            "stop",
            Some(i64::MIN),
            Some(i64::MAX),
            Some(100),
        ),
    ] {
        let mut session = fake_session();
        session.source.kind = "pi".into();
        let call = &mut session.model_calls[0];
        call.target.api = Some(api.into());
        call.stop_reason = Some(reason.into());
        call.timestamps = CallTimestamps {
            started_at_ms: start,
            recorded_at_ms: end,
        };
        call.reported_usage.output = output;
        push(&mut cases, name, session, TokenizationPolicy::Heuristic);
    }
    let zero_usage = ReportedUsage {
        input: Some(0),
        output: Some(0),
        cache_read: Some(0),
        cache_write: Some(0),
        reasoning: Some(0),
        total_tokens: Some(0),
        cost: ReportedCost {
            input: Some(0.0),
            output: Some(0.0),
            cache_read: Some(0.0),
            cache_write: Some(0.0),
            total: Some(0.0),
        },
        ..ReportedUsage::default()
    };
    push(
        &mut cases,
        "economics-zero",
        economics_session(zero_usage.clone()),
        TokenizationPolicy::Heuristic,
    );
    push(
        &mut cases,
        "economics-missing",
        economics_session(ReportedUsage::default()),
        TokenizationPolicy::Heuristic,
    );
    push(
        &mut cases,
        "economics-partial",
        economics_session(ReportedUsage {
            input: Some(0),
            cost: ReportedCost {
                input: Some(0.0),
                ..ReportedCost::default()
            },
            ..ReportedUsage::default()
        }),
        TokenizationPolicy::Heuristic,
    );
    let mut non_pi = economics_session(zero_usage);
    non_pi.source = SourceDescriptor {
        kind: "other-adapter".into(),
        version: "1".into(),
        cost_basis: CostBasis::SourceModelRates,
    };
    push(
        &mut cases,
        "economics-non-pi",
        non_pi,
        TokenizationPolicy::Heuristic,
    );
    push(
        &mut cases,
        "raw-safe-boundary",
        economics_session(ReportedUsage {
            input: Some(MAX_SAFE_JSON_INTEGER),
            cache_read: Some(0),
            cache_write: Some(0),
            output: Some(0),
            ..ReportedUsage::default()
        }),
        TokenizationPolicy::Heuristic,
    );

    let mut partial_zero = fake_session();
    partial_zero.context_items[0].payload = TokenizationPayload::UserMessage(MessageContent {
        parts: vec![ContentPart::Text(String::new()), ContentPart::Unsupported],
    });
    push(
        &mut cases,
        "partial-covered-zero",
        partial_zero,
        TokenizationPolicy::Heuristic,
    );
    let mut unavailable = fake_session();
    unavailable.context_items[0].payload = TokenizationPayload::Unavailable;
    push(
        &mut cases,
        "unavailable-payload",
        unavailable,
        TokenizationPolicy::Heuristic,
    );
    let mut image = fake_session();
    image.context_items[0].payload = TokenizationPayload::UserMessage(MessageContent {
        parts: vec![ContentPart::Image(ImageDescriptor {
            media_type: Some("image/png".into()),
            encoded_data_length: Some(8),
        })],
    });
    push(
        &mut cases,
        "encoded-image",
        image,
        TokenizationPolicy::Heuristic,
    );
    push(
        &mut cases,
        "terminal-zero-call",
        terminal_session(),
        TokenizationPolicy::Heuristic,
    );

    let mut mixed = fake_session();
    mixed.model_calls[0].target = ModelTarget {
        provider: Some("openai".into()),
        model: Some("gpt-4o-mini".into()),
        api: Some("openai-chat-completions".into()),
    };
    let mut next = mixed.model_calls[0].clone();
    next.index = 2;
    next.source_record_id = "second-call".into();
    next.target.model = Some("not-a-known-model".into());
    mixed.model_calls.push(next);
    mixed.context_items[0].presence[0].end_call = 2;
    mixed.context_items[0].last_model_call = 2;
    push(
        &mut cases,
        "mixed-estimate-coverage",
        mixed,
        TokenizationPolicy::Strict,
    );

    let two = two_items();
    cases.push((
        "derived-safe-boundary".into(),
        analysis_with_controlled_estimates(&two, &[vec![Some(MAX_SAFE_JSON_INTEGER - 1), Some(1)]]),
    ));
    cases.push((
        "session-exposure-exhaustion".into(),
        analysis_with_controlled_estimates(&two, &[vec![Some(MAX_SAFE_JSON_INTEGER - 1), Some(2)]]),
    ));
    let mut repeated = two_items();
    let template = repeated.model_calls[0].clone();
    repeated.model_calls = (1..=4)
        .map(|index| {
            let mut call = template.clone();
            call.index = index;
            call.source_record_id = format!("call-{index}");
            call.target.model = Some(format!("controlled-{index}"));
            call
        })
        .collect();
    for item in &mut repeated.context_items {
        item.last_model_call = 4;
        item.presence[0].end_call = 4;
    }
    cases.push((
        "item-exposure-exhaustion".into(),
        analysis_with_controlled_estimates(
            &repeated,
            &[
                vec![Some(MAX_SAFE_JSON_INTEGER), Some(1)],
                vec![Some(1), Some(1)],
                vec![None, Some(1)],
                vec![Some(0), Some(1)],
            ],
        ),
    ));

    // These fail in Rust, before any successful JSON reaches TypeScript.
    let mut dangling = fake_session();
    dangling.model_calls[0]
        .context_item_ids
        .push("missing-item".into());
    assert!(matches!(
        analyze(dangling, config(TokenizationPolicy::Heuristic)),
        Err(AnalysisError::InvalidSession(_))
    ));
    let mut unsafe_raw = fake_session();
    unsafe_raw.model_calls[0].reported_usage.input = Some(MAX_SAFE_JSON_INTEGER + 1);
    assert!(matches!(
        analyze(unsafe_raw, config(TokenizationPolicy::Heuristic)),
        Err(AnalysisError::InvalidSession(_))
    ));
    let mut unsafe_diagnostic = fake_session();
    unsafe_diagnostic.context_items[0].serialized_size_bytes = MAX_SAFE_JSON_INTEGER + 1;
    assert!(matches!(
        analyze(unsafe_diagnostic, config(TokenizationPolicy::Heuristic)),
        Err(AnalysisError::InvalidSession(_))
    ));
    let source = format!("{{\"type\":\"session\",\"id\":\"unsafe\",\"version\":3}}\n{{\"type\":\"message\",\"id\":\"call\",\"message\":{{\"role\":\"assistant\",\"usage\":{{\"input\":{}}}}}}}", MAX_SAFE_JSON_INTEGER + 1);
    assert!(matches!(
        PiSourceAdapter.parse(&mut Cursor::new(source)),
        Err(SourceError::UnsafeInteger { .. })
    ));
    assert!(matches!(
        PiSourceAdapter.parse_path_with_stats(&PathBuf::from("fixtures/pi/malformed-parent.jsonl")),
        Err(SourceError::InvalidStructure(_))
    ));

    // Exercise the actual SQLite -> replay -> qualified public DTO path too.
    let temporary = tempfile::tempdir().expect("synthetic OpenCode fixture");
    let database = temporary.path().join("opencode.db");
    let writer = rusqlite::Connection::open(&database).expect("synthetic database");
    writer
        .execute_batch(include_str!("../../fixtures/opencode/legacy-schema.sql"))
        .expect("synthetic schema");
    writer
        .execute_batch(include_str!("../../fixtures/opencode/simple.sql"))
        .expect("synthetic rows");
    let snapshot = crate::opencode::storage::load_session(&database, "ses_synthetic", None)
        .expect("read-only snapshot");
    let replay = crate::opencode::replay::reconstruct(
        snapshot,
        crate::opencode::usage::OutputAccounting::Unknown,
    )
    .expect("legacy replay");
    let opencode = crate::source::analyze_reconstructed(replay, config(TokenizationPolicy::Auto))
        .expect("qualified analysis");
    cases.push(("opencode-sqlite-auto".into(), opencode));
    writer
        .execute_batch(include_str!("../../fixtures/opencode/compaction.sql"))
        .expect("synthetic compaction rows");
    let snapshot = crate::opencode::storage::load_session(&database, "ses_synthetic", None)
        .expect("compacted snapshot");
    let replay = crate::opencode::replay::reconstruct(
        snapshot,
        crate::opencode::usage::OutputAccounting::Unknown,
    )
    .expect("compacted replay");
    let compacted = crate::source::analyze_reconstructed(replay, config(TokenizationPolicy::Auto))
        .expect("qualified compaction analysis");
    cases.push(("opencode-compaction-auto".into(), compacted));

    // Claude Code transcripts, through the same loader and coverage notice as HTTP.
    let claude_code = |fixture: &str, kind, billing| {
        let loaded = crate::source::load(
            &crate::source::SessionLocator::ClaudeCodeFile {
                path: PathBuf::from(format!("fixtures/claude-code/projects/{fixture}")),
                kind,
            },
            None,
        )
        .expect("Claude Code fixture");
        let mut analysis = analyze(
            loaded.normalized,
            AnalysisConfig {
                claude_code_billing: billing,
                ..config(TokenizationPolicy::Auto)
            },
        )
        .expect("Claude Code analysis");
        analysis.reconstruction = loaded.coverage_codes.map(|codes| ReconstructionCoverage {
            status: "partial",
            explanation_codes: codes,
        });
        analysis
    };
    for name in [
        "api-error",
        "attachments",
        "attachments-unrendered",
        "compaction",
        "compaction-legacy",
        "content-kinds",
        "cost-state",
        "cost-state-restarted",
        "parallel-last",
        "parallel-tools",
        "rewind",
        "simple",
        "split-response",
        "subagent-parent",
        "unfinished-line",
    ] {
        cases.push((
            format!("claude-code-{name}-auto"),
            claude_code(
                &format!("-synthetic-project/{name}.jsonl"),
                crate::claude_code::FileKind::Main,
                ClaudeCodeBilling::Subscription,
            ),
        ));
    }
    cases.push((
        "claude-code-subagent-auto".into(),
        claude_code(
            "-synthetic-project/subagent-parent/subagents/agent-a16.jsonl",
            crate::claude_code::FileKind::Subagent,
            ClaudeCodeBilling::Subscription,
        ),
    ));
    cases.push((
        "claude-code-compaction-api-billing-auto".into(),
        claude_code(
            "-synthetic-project/compaction.jsonl",
            crate::claude_code::FileKind::Main,
            ClaudeCodeBilling::Api,
        ),
    ));

    let modern_database = temporary.path().join("modern.db");
    let modern_writer = rusqlite::Connection::open(&modern_database).expect("modern database");
    modern_writer
        .execute_batch(include_str!("../../fixtures/opencode/modern-schema.sql"))
        .expect("modern schema");
    modern_writer
        .execute_batch(include_str!("../../fixtures/opencode/modern.sql"))
        .expect("modern fixture");
    for name in [
        "opencode-modern-auto",
        "opencode-modern-terminal-auto",
        "opencode-modern-aggregate-auto",
        "opencode-modern-adjacent-auto",
    ] {
        if name == "opencode-modern-terminal-auto" {
            modern_writer.execute("INSERT INTO session_message VALUES ('msg_terminal', 'ses_modern', 'compaction', 10, 100, 100, ?1)",
                [serde_json::json!({"status":"completed","reason":"manual","summary":"Synthetic terminal summary","recent":"Synthetic terminal recent","time":{"created":100}}).to_string()]).expect("terminal modern checkpoint");
        }
        if name == "opencode-modern-aggregate-auto" {
            modern_writer.execute("UPDATE session_message SET data=json_set(data, '$.tokens', json(?1), '$.cost', 0.05) WHERE id='msg_checkpoint'",
                [serde_json::json!({"input":12,"output":3,"reasoning":0,"cache":{"read":0,"write":0}}).to_string()]).expect("recorded aggregate usage");
        }
        if name == "opencode-modern-adjacent-auto" {
            modern_writer
                .execute("UPDATE session_message SET seq=seq+10 WHERE seq>=6", [])
                .expect("make sequence room");
            modern_writer.execute("INSERT INTO session_message VALUES ('msg_adjacent', 'ses_modern', 'compaction', 6, 56, 56, ?1)",
                [serde_json::json!({"status":"completed","reason":"manual","summary":"Synthetic replacement summary","recent":"Synthetic replacement recent","time":{"created":56}}).to_string()]).expect("adjacent modern checkpoint");
        }
        let snapshot = crate::opencode::storage::load_session(&modern_database, "ses_modern", None)
            .expect("modern snapshot");
        let replay = crate::opencode::replay::reconstruct(
            snapshot,
            crate::opencode::usage::OutputAccounting::Unknown,
        )
        .expect("modern replay");
        cases.push((
            name.into(),
            crate::source::analyze_reconstructed(replay, config(TokenizationPolicy::Auto))
                .expect("qualified modern analysis"),
        ));
    }

    // Source-neutral reference counters: the consumer must not choose display
    // or arithmetic from a harness name, nor sum counters with unknown overlap.
    for (name, relationship, raw, normalized) in [
        (
            "usage-recorded-inclusive",
            OutputReasoningRelationship::IncludesReasoning,
            30,
            Some(30),
        ),
        (
            "usage-recorded-disjoint",
            OutputReasoningRelationship::ExcludesReasoning,
            20,
            Some(30),
        ),
        (
            "usage-recorded-unknown",
            OutputReasoningRelationship::Unknown,
            20,
            None,
        ),
    ] {
        let mut session = fake_session();
        session.source.kind = "future-harness".into();
        session.model_calls[0].reported_usage = ReportedUsage {
            output: normalized,
            recorded_output: Some(raw),
            output_reasoning_relationship: relationship,
            reasoning: Some(10),
            ..ReportedUsage::default()
        };
        push(&mut cases, name, session, TokenizationPolicy::Off);
    }

    // One case per kind of cost assessment, priced from the embedded table.
    for (name, harness, provider, model, recorded_cost, output, timed) in [
        (
            "cost-recorded",
            "opencode",
            "anthropic",
            "claude-sonnet-4-6",
            Some(0.25),
            Some(100),
            true,
        ),
        (
            "cost-estimated",
            "opencode",
            "anthropic",
            "claude-sonnet-4-6",
            None,
            Some(100),
            true,
        ),
        (
            "cost-api-equivalent",
            "pi",
            "openai-codex",
            "gpt-6.1-sol",
            Some(0.02),
            Some(100),
            true,
        ),
        (
            "cost-api-equivalent-range",
            "opencode",
            "openai",
            "gpt-5.6-sol",
            Some(0.0),
            None,
            true,
        ),
        (
            "cost-free",
            "opencode",
            "opencode",
            "big-pickle",
            Some(0.0),
            Some(100),
            true,
        ),
        (
            "cost-unknown",
            "opencode",
            "anthropic",
            "claude-sonnet-4-6",
            None,
            Some(100),
            false,
        ),
    ] {
        let mut session = fake_session();
        session.source.kind = harness.into();
        let call = &mut session.model_calls[0];
        call.target = ModelTarget {
            provider: Some(provider.into()),
            model: Some(model.into()),
            api: None,
        };
        if timed {
            // 15 September 2026.
            call.timestamps.recorded_at_ms = Some(1_789_430_400_000);
        }
        call.reported_usage = ReportedUsage {
            input: Some(20_000),
            cache_read: Some(80_000),
            cache_write: Some(0),
            output,
            recorded_output: Some(100),
            reasoning: Some(400_000),
            cost: ReportedCost {
                total: recorded_cost,
                ..ReportedCost::default()
            },
            ..ReportedUsage::default()
        };
        let mut analysis = analyze(session, config(TokenizationPolicy::Off)).expect("cost case");
        if harness == "opencode" {
            // Every OpenCode response carries its reconstruction limits.
            analysis.reconstruction = Some(crate::api::ReconstructionCoverage {
                status: "partial",
                explanation_codes: vec!["missingHistoricalSystemPrompt".into()],
            });
        }
        cases.push((name.into(), analysis));
    }

    let export = std::env::var_os("TOKENPLUME_CONTRACT_DIR").map(PathBuf::from);
    if let Some(directory) = &export {
        assert!(
            directory.is_absolute() && directory.is_dir(),
            "orchestrator supplies an absolute temporary directory"
        );
        assert!(
            fs::read_dir(directory)
                .expect("export directory")
                .next()
                .is_none(),
            "never reuse stale exports"
        );
    }
    let mut manifest = Vec::new();
    let mut names = HashSet::new();
    for (name, analysis) in cases {
        assert!(names.insert(name.clone()), "unique contract case");
        let json = serde_json::to_value(&analysis).expect("analysis JSON");
        assert_safe_raw_integers(&json);
        let file = format!("{name}.json");
        if let Some(directory) = &export {
            // Exactly the serializer used by execute_analysis, not a test-only wire representation.
            fs::write(
                directory.join(&file),
                serde_json::to_vec(&analysis).expect("response bytes"),
            )
            .expect("export response");
        }
        manifest.push(serde_json::json!({ "name": name, "file": file }));
    }
    assert_eq!(manifest.len(), 127);
    if let Some(directory) = export {
        let manifest = serde_json::json!({ "schemaVersion": ANALYSIS_SCHEMA_VERSION, "outputVersion": ANALYSIS_OUTPUT_VERSION,
            "cases": manifest, "rejections": [
                { "name": "dangling-normalized-reference", "category": "invalid-session" },
                { "name": "unsafe-normalized-usage", "category": "invalid-session" },
                { "name": "unsafe-serialized-diagnostic", "category": "invalid-session" },
                { "name": "unsafe-source-usage", "category": "source-unsafe-integer" },
                { "name": "malformed-source-parent", "category": "source-structure" }
            ] });
        fs::write(
            directory.join("manifest.json"),
            serde_json::to_vec(&manifest).expect("manifest"),
        )
        .expect("publish complete manifest last");
    }
}
