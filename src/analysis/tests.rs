use super::*;
use crate::domain::{SessionSourceAdapter, SourceError};

use super::test_support::{analysis_with_controlled_estimates, fake_session};

fn item_ids<'a>(analysis: &'a Analysis, indexes: &[usize]) -> Vec<&'a str> {
    indexes
        .iter()
        .map(|index| analysis.context_items[*index].id.as_str())
        .collect()
}

fn assert_exhausted_session_exposure(analysis: &Analysis, items: usize, calls: usize) {
    let json = serde_json::to_value(analysis).expect("analysis JSON");
    assert!(json["session"]["calculatedTokenTurns"].is_null());
    assert!(json["tokenAnalysis"]["totalCalculatedTokenTurns"].is_null());
    for coverage in [
        &json["session"]["calculatedTokenTurnsCoverage"],
        &json["tokenAnalysis"]["totalTokenTurnsCoverage"],
    ] {
        assert_eq!(
            *coverage,
            serde_json::json!({
                "completeItems": 0, "partialItems": 0, "unavailableItems": items,
                "totalItems": items, "coveredCalls": 0, "totalCalls": calls,
            })
        );
    }
}

#[test]
fn inconsistent_placeholder_evidence_is_rejected_before_projection() {
    use crate::pi::PiSourceAdapter;
    let original = PiSourceAdapter
        .parse_path_with_stats(std::path::Path::new("fixtures/pi/failed-usage.jsonl"))
        .expect("fixture")
        .0;
    for mutation in 0..4 {
        let mut session = original.clone();
        let usage = &mut session.model_calls[1].reported_usage;
        match mutation {
            0 => usage.input = Some(0),
            1 => usage.cost.total = Some(0.0),
            2 => {
                usage.placeholder.as_mut().expect("raw").reasoning = Some(MAX_SAFE_JSON_INTEGER + 1)
            }
            _ => usage.placeholder.as_mut().expect("raw").cost.total = Some(f64::NAN),
        }
        let error = analyze(
            session,
            AnalysisConfig {
                tokenization: TokenizationPolicy::Auto,
                perf_diagnostics: false,
                claude_code_billing: Default::default(),
            },
        )
        .expect_err("invalid evidence");
        assert!(error.to_string().contains("placeholder evidence"));
    }
}

#[test]
fn failed_usage_placeholders_do_not_become_measurements_or_complete_rollups() {
    use crate::pi::PiSourceAdapter;
    let session = PiSourceAdapter
        .parse_path_with_stats(std::path::Path::new("fixtures/pi/failed-usage.jsonl"))
        .expect("fixture")
        .0;
    let analysis = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Auto,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("analysis");
    assert_eq!(analysis.model_calls.len(), 6);
    for call in &analysis.model_calls[1..3] {
        assert!(call.usage.placeholder.is_some());
        assert!(call.reported_prompt_tokens.is_none());
        assert!(call.reported_completion_tokens.is_none());
        assert!(call.reported_total_tokens.is_none());
        assert_eq!(call.reported_usage_completeness, "missing");
        assert!(call.cost.is_none());
        assert_eq!(
            call.economics.usage_completeness,
            EconomicsCompleteness::Missing
        );
        assert_eq!(
            call.economics.cost_completeness,
            EconomicsCompleteness::Missing
        );
        assert!(call.economics.cache_read_ratio.is_none());
        assert!(call.timing.effective_output_tokens_per_second.is_none());
        assert!(call
            .token_analysis
            .calculated_visible_tokens
            .is_some_and(|n| n > 0));
        assert!(call.cumulative_reported_prompt_tokens.is_none());
        assert!(call.cumulative_reported_completion_tokens.is_none());
    }
    assert_eq!(
        analysis.model_calls[1].context_item_indexes,
        analysis.model_calls[3].context_item_indexes
    );
    assert_eq!(
        analysis.model_calls[1]
            .token_analysis
            .calculated_visible_tokens,
        analysis.model_calls[3]
            .token_analysis
            .calculated_visible_tokens
    );
    assert_eq!(analysis.model_calls[3].reported_prompt_tokens, Some(150));
    assert_eq!(analysis.model_calls[4].reported_prompt_tokens, Some(0));
    assert_eq!(analysis.model_calls[4].reported_completion_tokens, Some(0));
    assert_eq!(
        analysis.model_calls[4]
            .cost
            .as_ref()
            .expect("measured zero cost")
            .total,
        Some(0.0)
    );
    assert!(analysis.model_calls[4].usage.placeholder.is_none());
    assert_eq!(analysis.model_calls[5].reported_prompt_tokens, Some(200));
    assert!(analysis.model_calls[5].usage.placeholder.is_none());
    // Session subtotals keep what was recorded and count failed attempts
    // separately instead of treating their default zeros as measurements.
    let recorded_prompt = analysis
        .model_calls
        .iter()
        .filter_map(|call| call.reported_prompt_tokens)
        .sum::<u64>();
    assert_eq!(
        analysis.session.reported_prompt_tokens,
        Some(recorded_prompt)
    );
    assert_eq!(
        analysis.session.reported_usage_coverage,
        RecordedCallCoverage {
            recorded_calls: 4,
            failed_attempt_calls: 2,
            missing_calls: 0,
        }
    );
    assert_eq!(
        analysis.session.reported_cost_coverage.failed_attempt_calls,
        2
    );
    assert_eq!(
        analysis.session.reported_cost_coverage.recorded_calls
            + analysis.session.reported_cost_coverage.missing_calls,
        4
    );
    assert_eq!(analysis.session.reported_usage_completeness, "partial");
    assert_eq!(analysis.economics.cache_read_eligible_calls, 4);
}

#[test]
fn item_token_turn_overflow_is_sticky_and_invalidates_session_subtotals() {
    let mut session = fake_session();
    let mut safe_item = session.context_items[0].clone();
    safe_item.id = "safe-item".into();
    safe_item.payload = TokenizationPayload::UserMessage(MessageContent::text("distinct payload"));
    session.context_items.push(safe_item);
    let template = session.model_calls[0].clone();
    session.model_calls = (1..=4)
        .map(|index| {
            let mut call = template.clone();
            call.index = index;
            call.source_record_id = format!("call-{index}");
            call.target.model = Some(format!("controlled-model-{index}"));
            call.context_item_ids.push("safe-item".into());
            call
        })
        .collect();
    for item in &mut session.context_items {
        item.last_model_call = 4;
        item.presence[0].end_call = 4;
    }
    // MAX + 1 exhausts the first item. Missing and numeric-zero observations
    // afterward must not restore its total; the other item remains valid.
    let analysis = analysis_with_controlled_estimates(
        &session,
        &[
            vec![Some(MAX_SAFE_JSON_INTEGER), Some(1)],
            vec![Some(1), Some(1)],
            vec![None, Some(1)],
            vec![Some(0), Some(1)],
        ],
    );
    let exhausted = &analysis.context_items[0];
    assert_eq!(exhausted.token_turns, None);
    assert_eq!(exhausted.token_turns_coverage.complete_items, 0);
    assert_eq!(exhausted.token_turns_coverage.partial_items, 0);
    assert_eq!(exhausted.token_turns_coverage.unavailable_items, 1);
    assert_eq!(exhausted.token_turns_coverage.covered_calls, 3);
    assert_eq!(exhausted.token_turns_coverage.total_calls, 4);
    assert_eq!(analysis.context_items[1].token_turns, Some(4));
    assert_eq!(
        analysis.context_items[1]
            .token_turns_coverage
            .complete_items,
        1
    );
    assert_exhausted_session_exposure(&analysis, 2, 8);
}

#[test]
fn session_token_turn_overflow_preserves_valid_items_but_not_a_partial_subtotal() {
    let mut session = fake_session();
    let template = session.context_items[0].clone();
    for index in 1..=2 {
        let mut item = template.clone();
        item.id = format!("item-{index}");
        item.payload = TokenizationPayload::UserMessage(MessageContent::text(format!(
            "distinct payload {index}"
        )));
        session.model_calls[0]
            .context_item_ids
            .push(item.id.clone());
        session.context_items.push(item);
    }
    // Exact safe boundary remains numeric, including an observed zero.
    let boundary = analysis_with_controlled_estimates(
        &session,
        &[vec![Some(MAX_SAFE_JSON_INTEGER - 1), Some(1), Some(0)]],
    );
    assert_eq!(
        boundary.session.calculated_token_turns,
        Some(MAX_SAFE_JSON_INTEGER)
    );
    assert_eq!(
        boundary.token_analysis.total_calculated_token_turns,
        Some(MAX_SAFE_JSON_INTEGER)
    );
    assert_eq!(boundary.context_items[2].token_turns, Some(0));

    let analysis = analysis_with_controlled_estimates(
        &session,
        &[vec![Some(MAX_SAFE_JSON_INTEGER - 1), Some(2), Some(7)]],
    );
    for (item, expected) in analysis
        .context_items
        .iter()
        .zip([MAX_SAFE_JSON_INTEGER - 1, 2, 7])
    {
        assert_eq!(item.token_turns, Some(expected));
        assert_eq!(item.token_turns_coverage.complete_items, 1);
    }
    assert_eq!(
        analysis
            .token_analysis
            .item_estimate_coverage
            .complete_items,
        3
    );
    assert_exhausted_session_exposure(&analysis, 3, 3);
}

struct FakeSourceAdapter;

impl SessionSourceAdapter for FakeSourceAdapter {
    fn source_descriptor(&self) -> SourceDescriptor {
        SourceDescriptor {
            kind: "fake".into(),
            version: "test-v1".into(),
            cost_basis: CostBasis::Unknown,
        }
    }

    fn parse(&self, _input: &mut dyn std::io::BufRead) -> Result<NormalizedSession, SourceError> {
        Ok(fake_session())
    }
}

#[test]
fn analysis_accepts_a_source_neutral_fake_adapter() {
    let mut input = std::io::Cursor::new(Vec::<u8>::new());
    let normalized = FakeSourceAdapter.parse(&mut input).expect("fake source");
    let analysis = analyze(
        normalized,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("analysis");
    assert_eq!(analysis.session.source, "fake");
    assert_eq!(analysis.context_items[0].id, "opaque-item");
}

#[test]
fn source_neutral_command_payload_remains_supported_without_pi_command_support() {
    let mut session = fake_session();
    session.context_items[0].kind = ContextItemKind::Other;
    session.context_items[0].payload = TokenizationPayload::CommandExecution {
        command: "echo hello".into(),
        output: "hello".into(),
        excluded_from_context: false,
    };
    let analysis = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("command-capable source analysis");
    assert!(analysis.context_items[0].token_turns.is_some());
    assert!(analysis.context_items[0]
        .preview
        .as_ref()
        .expect("command preview")
        .text
        .contains("echo hello"));
}

#[test]
fn analysis_accepts_source_neutral_opaque_ids() {
    let analysis = analyze(
        fake_session(),
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("analysis");
    assert_eq!(analysis.context_items[0].id, "opaque-item");
    assert_eq!(
        analysis.model_calls[0]
            .token_analysis
            .calculated_visible_tokens,
        Some(3)
    );
    assert_eq!(analysis.display_weight_unit, "estimatedTokens");
    assert_eq!(
        analysis.token_analysis.fallback_reason.as_deref(),
        Some("best-effort-tokenization")
    );
}

#[test]
fn transition_membership_preserves_context_order_and_metrics() {
    let mut session = fake_session();
    let item = |id: &str, start_call, end_call| NormalizedContextItem {
        id: id.into(),
        kind: ContextItemKind::UserMessage,
        label: id.into(),
        source_record_id: Some(format!("record-{id}")),
        source_tool_call_id: None,
        metadata: BTreeMap::new(),
        serialized_size_bytes: 4,
        payload: TokenizationPayload::UserMessage(MessageContent::text(id)),
        presence: vec![PresenceRange {
            start_call,
            end_call,
        }],
        first_model_call: start_call,
        last_model_call: end_call,
    };
    session.context_items = vec![
        item("a", 1, 1),
        item("b", 1, 3),
        item("c", 1, 3),
        item("d", 2, 3),
    ];
    let call = |index, ids: &[&str]| NormalizedModelCall {
        tool_loadout_known: false,
        index,
        source_record_id: format!("call-{index}"),
        target: ModelTarget {
            provider: Some("unknown".into()),
            model: Some("unknown".into()),
            api: None,
        },
        reported_usage: ReportedUsage::default(),
        stop_reason: None,
        timestamps: CallTimestamps::default(),
        context_item_ids: ids.iter().map(|id| (*id).to_owned()).collect(),
        tool_calls_after: vec![],
        compaction_before: None,
    };
    session.model_calls = vec![
        call(1, &["a", "b", "c"]),
        call(2, &["b", "c", "d"]),
        call(3, &["b", "c", "d"]),
    ];

    let analysis = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("analysis");

    let first = &analysis.model_calls[0];
    assert_eq!(
        item_ids(&analysis, &first.added_item_indexes),
        ["a", "b", "c"]
    );
    assert!(first.dropped_item_indexes.is_empty());
    assert_eq!(first.transition_item_counts.added, 3);
    assert_eq!(first.transition_item_counts.retained, 0);
    assert_eq!(first.token_analysis.retained_tokens, Some(0));
    assert_eq!(first.token_analysis.dropped_tokens, Some(0));
    assert_eq!(first.token_analysis.churn, None);

    let changed = &analysis.model_calls[1];
    assert_eq!(item_ids(&analysis, &changed.added_item_indexes), ["d"]);
    assert_eq!(item_ids(&analysis, &changed.dropped_item_indexes), ["a"]);
    assert_eq!(changed.transition_item_counts.added, 1);
    assert_eq!(changed.transition_item_counts.retained, 2);
    assert_eq!(changed.transition_item_counts.dropped, 1);
    assert!(changed.token_analysis.added_tokens.is_some());
    assert!(changed.token_analysis.retained_tokens.is_some());
    assert!(changed.token_analysis.dropped_tokens.is_some());

    let unchanged = &analysis.model_calls[2];
    assert!(unchanged.added_item_indexes.is_empty());
    assert!(unchanged.dropped_item_indexes.is_empty());
    assert_eq!(unchanged.transition_item_counts.added, 0);
    assert_eq!(unchanged.transition_item_counts.retained, 3);
    assert_eq!(unchanged.transition_item_counts.dropped, 0);
}

#[test]
fn unavailable_token_geometry_is_explicit() {
    let analysis = analyze(
        fake_session(),
        AnalysisConfig {
            tokenization: TokenizationPolicy::Strict,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("analysis");
    assert_eq!(analysis.display_weight_unit, "unavailable");
    assert_eq!(
        analysis.token_analysis.fallback_reason.as_deref(),
        Some("one-or-more-context-items-unavailable")
    );
    assert!(analysis.context_items[0]
        .token_estimates
        .iter()
        .all(|estimate| estimate.tokens.is_none()));
    assert_eq!(analysis.context_items[0].token_turns, None);
    assert_eq!(
        analysis.context_items[0]
            .token_turns_coverage
            .unavailable_items,
        1
    );
    assert_eq!(analysis.session.calculated_token_turns, None);
    assert_eq!(
        analysis
            .token_analysis
            .total_token_turns_coverage
            .unavailable_items,
        1
    );
}

#[test]
fn complete_provider_usage_is_reconciled_without_using_total_tokens() {
    let mut session = fake_session();
    session.model_calls[0].target = ModelTarget {
        provider: Some("openai".into()),
        model: Some("gpt-4o-mini".into()),
        api: Some("openai-chat-completions".into()),
    };
    session.model_calls[0].reported_usage = ReportedUsage {
        input: Some(2),
        output: Some(7),
        cache_read: Some(0),
        cache_write: Some(0),
        reasoning: Some(1),
        total_tokens: Some(9),
        ..ReportedUsage::default()
    };
    let analysis = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Auto,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("analysis");
    assert_eq!(analysis.display_weight_unit, "calculatedTokens");
    let call = &analysis.model_calls[0];
    assert_eq!(call.reported_prompt_tokens, Some(2));
    assert_eq!(call.reported_total_tokens, Some(9));
    assert_eq!(call.cumulative_reported_prompt_tokens, Some(2));
    assert_eq!(call.cumulative_reported_completion_tokens, Some(7));
    assert_eq!(call.cumulative_reported_usage_completeness, "complete");
    assert!(call.token_analysis.residual_tokens.is_some());
    assert_eq!(call.token_analysis.status, "large");
    assert_eq!(analysis.session.reconciliation_complete_calls, 1);
}

#[test]
fn normalized_unknown_references_are_invariant_errors() {
    let mut session = fake_session();
    session.model_calls[0].context_item_ids = vec!["opaque-item".into(), "missing".into()];
    let error = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect_err("unknown normalized references must fail");
    assert!(
        matches!(error, AnalysisError::InvalidSession(message) if message.contains("unknown item"))
    );
}

#[test]
fn normalized_presence_must_match_membership_and_ranges() {
    let mut session = fake_session();
    session.context_items[0].presence = vec![PresenceRange {
        start_call: 2,
        end_call: 1,
    }];
    session.context_items[0].first_model_call = 2;
    session.context_items[0].last_model_call = 1;
    let error = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect_err("inverted ranges must fail");
    assert!(matches!(error, AnalysisError::InvalidSession(message) if message.contains("invalid")));
}

#[test]
fn serialized_byte_diagnostics_keep_the_legacy_field_without_affecting_token_geometry() {
    for policy in [TokenizationPolicy::Heuristic, TokenizationPolicy::Off] {
        let mut outputs = Vec::new();
        for size in [0, MAX_SAFE_JSON_INTEGER] {
            let mut session = fake_session();
            session.context_items[0].serialized_size_bytes = size;
            let analysis = analyze(
                session,
                AnalysisConfig {
                    tokenization: policy,
                    perf_diagnostics: false,
                    claude_code_billing: Default::default(),
                },
            )
            .expect("safe diagnostic");
            let weight = analysis.context_items[0].display_weight;
            assert!(weight.is_finite() && weight >= 0.0);
            assert_eq!(weight, size as f64);
            if policy == TokenizationPolicy::Off {
                assert_eq!(analysis.display_weight_unit, "unavailable");
                assert_eq!(
                    analysis.model_calls[0]
                        .token_analysis
                        .calculated_visible_tokens,
                    None
                );
            }
            let mut json = serde_json::to_value(analysis).expect("JSON");
            let item = json["contextItems"][0].as_object_mut().expect("wire item");
            assert!(item.remove("displayWeight").is_some());
            assert!(!item.contains_key("serializedSizeBytes"));
            outputs.push(json);
        }
        assert_eq!(
            outputs[0], outputs[1],
            "serialized diagnostics must not supply geometry"
        );
    }
}

#[test]
fn valid_zero_call_terminal_summary_is_accepted() {
    let summary = NormalizedContextItem {
        id: "summary".into(),
        kind: ContextItemKind::CompactionSummary,
        label: "summary".into(),
        source_record_id: Some("compaction".into()),
        source_tool_call_id: None,
        metadata: BTreeMap::new(),
        serialized_size_bytes: 10,
        payload: TokenizationPayload::CompactionSummary(String::new()),
        presence: Vec::new(),
        first_model_call: 0,
        last_model_call: 0,
    };
    let session = NormalizedSession {
        harness_session_cost: None,
        id: "terminal".into(),
        source: SourceDescriptor {
            kind: "fake".into(),
            version: "1".into(),
            cost_basis: CostBasis::Unknown,
        },
        title: None,
        working_directory: None,
        context_items: vec![summary],
        model_calls: Vec::new(),
        compactions: vec![NormalizedCompaction {
            id: "compaction".into(),
            before_model_call: 1,
            source_item_ids: Vec::new(),
            retained_item_ids: Vec::new(),
            summary_item_id: "summary".into(),
            tokens_before: None,
        }],
        lineage: Vec::new(),
    };
    let analysis = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("terminal zero-call summary is valid");
    let summary = &analysis.context_items[0];
    assert_eq!(summary.first_model_call, 0);
    assert_eq!(summary.last_model_call, 0);
    assert_eq!(summary.age_at_final_model_call, None);
    assert_eq!(summary.presence_call_count, 0);
    let json = serde_json::to_value(summary).expect("wire summary");
    assert_eq!(json["firstModelCall"], 0);
    assert_eq!(json["lastModelCall"], 0);
    assert!(json["ageAtFinalModelCall"].is_null());
}

#[test]
fn terminal_summary_cannot_be_referenced_by_an_earlier_call() {
    let mut session = fake_session();
    session.context_items.push(NormalizedContextItem {
        id: "terminal-summary".into(),
        kind: ContextItemKind::CompactionSummary,
        label: "summary".into(),
        source_record_id: Some("compaction".into()),
        source_tool_call_id: None,
        metadata: BTreeMap::new(),
        serialized_size_bytes: 10,
        payload: TokenizationPayload::CompactionSummary(String::new()),
        presence: Vec::new(),
        first_model_call: 0,
        last_model_call: 0,
    });
    session.model_calls[0]
        .context_item_ids
        .push("terminal-summary".into());
    session.compactions.push(NormalizedCompaction {
        id: "compaction".into(),
        before_model_call: 2,
        source_item_ids: vec!["opaque-item".into()],
        retained_item_ids: Vec::new(),
        summary_item_id: "terminal-summary".into(),
        tokens_before: None,
    });
    let error = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect_err("terminal summary must not have earlier membership");
    assert!(
        matches!(error, AnalysisError::InvalidSession(message) if message.contains("no presence"))
    );
}

#[test]
fn terminal_summary_does_not_degrade_applicable_exposure() {
    let mut session = fake_session();
    session.context_items.push(NormalizedContextItem {
        id: "terminal-summary".into(),
        kind: ContextItemKind::CompactionSummary,
        label: "summary".into(),
        source_record_id: Some("compaction".into()),
        source_tool_call_id: None,
        metadata: BTreeMap::new(),
        serialized_size_bytes: 10,
        payload: TokenizationPayload::CompactionSummary(String::new()),
        presence: Vec::new(),
        first_model_call: 0,
        last_model_call: 0,
    });
    session.compactions.push(NormalizedCompaction {
        id: "compaction".into(),
        before_model_call: 2,
        source_item_ids: vec!["opaque-item".into()],
        retained_item_ids: Vec::new(),
        summary_item_id: "terminal-summary".into(),
        tokens_before: None,
    });
    let analysis = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("terminal summary analysis");
    assert_eq!(analysis.session.calculated_token_turns, Some(3));
    assert_eq!(
        analysis.token_analysis.item_estimate_coverage.total_items,
        1
    );
    let summary = analysis
        .context_items
        .iter()
        .find(|item| item.id == "terminal-summary")
        .expect("terminal summary");
    assert_eq!(summary.token_turns, None);
    assert_eq!(summary.token_turns_coverage.total_items, 0);
}

#[test]
fn normalized_values_above_safe_integer_are_rejected_before_analysis() {
    let mut session = fake_session();
    session.context_items[0].serialized_size_bytes = MAX_SAFE_JSON_INTEGER + 1;
    let error = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect_err("unsafe normalized integer must fail");
    assert!(
        matches!(error, AnalysisError::InvalidSession(message) if message.contains("serialized size"))
    );
}

#[test]
fn empty_sessions_have_missing_usage_totals() {
    let mut session = fake_session();
    session.model_calls.clear();
    session.context_items.clear();
    let analysis = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("analysis");
    assert_eq!(analysis.session.reported_prompt_tokens, None);
    assert_eq!(analysis.session.reported_completion_tokens, None);
    assert_eq!(analysis.session.reported_reasoning_tokens, None);
    assert_eq!(analysis.session.reported_usage_completeness, "missing");
    assert_eq!(analysis.session.calculated_token_turns, None);
    assert_eq!(
        analysis
            .token_analysis
            .total_token_turns_coverage
            .total_items,
        0
    );
}

#[test]
fn analysis_preserves_unsupported_content_coverage() {
    let mut session = fake_session();
    session.context_items[0].payload = TokenizationPayload::UserMessage(MessageContent {
        parts: vec![ContentPart::Text(String::new()), ContentPart::Unsupported],
    });
    let analysis = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("analysis");
    let call = &analysis.model_calls[0];
    assert_eq!(call.token_analysis.estimate_coverage.partial_items, 1);
    assert!(call
        .token_analysis
        .explanation_codes
        .iter()
        .any(|code| code == "unsupportedPayload"));
    assert_eq!(analysis.context_items[0].token_turns, Some(0));
    assert_eq!(
        analysis.context_items[0].token_turns_coverage.partial_items,
        1
    );
    assert_eq!(analysis.session.calculated_token_turns, Some(0));
}

#[test]
fn mixed_complete_and_unavailable_item_calls_are_partial_with_numeric_value() {
    let mut session = fake_session();
    session.context_items[0].presence = vec![PresenceRange {
        start_call: 1,
        end_call: 2,
    }];
    session.context_items[0].last_model_call = 2;
    session.model_calls.push(NormalizedModelCall {
        tool_loadout_known: false,
        index: 2,
        source_record_id: "call-2".into(),
        target: ModelTarget {
            provider: Some("openai".into()),
            model: Some("not-a-known-model".into()),
            api: None,
        },
        reported_usage: ReportedUsage::default(),
        stop_reason: None,
        timestamps: CallTimestamps::default(),
        context_item_ids: vec!["opaque-item".into()],
        tool_calls_after: Vec::new(),
        compaction_before: None,
    });
    session.model_calls[0].target = ModelTarget {
        provider: Some("openai".into()),
        model: Some("gpt-4o-mini".into()),
        api: Some("openai-chat-completions".into()),
    };
    let analysis = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Strict,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("valid mixed coverage");
    let item = &analysis.context_items[0];
    assert_eq!(item.token_turns, Some(2));
    assert_eq!(item.token_turns_coverage.complete_items, 0);
    assert_eq!(item.token_turns_coverage.partial_items, 1);
    assert_eq!(item.token_turns_coverage.unavailable_items, 0);
    assert_eq!(item.token_turns_coverage.covered_calls, 1);
    assert_eq!(item.token_turns_coverage.total_calls, 2);
    assert_eq!(analysis.session.calculated_token_turns, Some(2));
}

#[test]
fn tokenizer_support_does_not_imply_known_request_framing() {
    let mut session = fake_session();
    session.model_calls[0].target = ModelTarget {
        provider: Some("openai".into()),
        model: Some("gpt-4o-mini".into()),
        api: None,
    };
    session.model_calls[0].reported_usage = ReportedUsage {
        input: Some(2),
        cache_read: Some(0),
        cache_write: Some(0),
        ..ReportedUsage::default()
    };
    let analysis = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Auto,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("analysis");
    let call = &analysis.model_calls[0];
    assert!(call.token_analysis.calculated_visible_tokens.is_some());
    assert_eq!(call.token_analysis.known_framing_overhead_tokens, None);
    assert_eq!(call.token_analysis.calculated_request_tokens, None);
    assert_eq!(call.token_analysis.status, "unavailable");
    assert_eq!(analysis.session.reconciliation_complete_calls, 0);
}

#[test]
fn known_framing_requires_text_only_chat_composition() {
    let mut text_session = fake_session();
    text_session.model_calls[0].target = ModelTarget {
        provider: Some("openai".into()),
        model: Some("gpt-4o-mini".into()),
        api: Some("openai-chat-completions".into()),
    };
    let text_analysis = analyze(
        text_session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Strict,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("text-only chat analysis");
    assert_eq!(
        text_analysis.model_calls[0]
            .token_analysis
            .known_framing_overhead_tokens,
        Some(6)
    );

    let mut tool_session = fake_session();
    tool_session.context_items[0].kind = ContextItemKind::ToolResult;
    tool_session.context_items[0].payload = TokenizationPayload::ToolResult {
        tool_call_id: "tool-1".into(),
        tool_name: "shell".into(),
        content: MessageContent {
            parts: vec![ContentPart::Text("output".into())],
        },
        is_error: false,
    };
    tool_session.model_calls[0].target = ModelTarget {
        provider: Some("openai".into()),
        model: Some("gpt-4o-mini".into()),
        api: Some("openai-chat-completions".into()),
    };
    let tool_analysis = analyze(
        tool_session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Strict,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("tool analysis");
    assert_eq!(
        tool_analysis.model_calls[0]
            .token_analysis
            .known_framing_overhead_tokens,
        None
    );

    let mut empty_session = fake_session();
    empty_session.context_items.clear();
    empty_session.model_calls[0].context_item_ids.clear();
    empty_session.model_calls[0].target = ModelTarget {
        provider: Some("openai".into()),
        model: Some("gpt-4o-mini".into()),
        api: Some("openai-chat-completions".into()),
    };
    let empty_analysis = analyze(
        empty_session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Strict,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("zero-message chat analysis");
    assert_eq!(
        empty_analysis.model_calls[0]
            .token_analysis
            .known_framing_overhead_tokens,
        Some(3)
    );
    assert_eq!(empty_analysis.session.calculated_token_turns, Some(0));
}

#[test]
fn transition_and_age_metrics_include_partial_estimates_and_say_so() {
    use crate::pi::PiSourceAdapter;
    let session = PiSourceAdapter
        .parse_path_with_stats(std::path::Path::new("fixtures/pi/system-context.jsonl"))
        .expect("fixture")
        .0;
    let analysis = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Auto,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("analysis");
    for call in &analysis.model_calls[1..] {
        let metrics = &call.token_analysis;
        assert!(metrics.estimate_coverage.partial_items > 0);
        assert!(metrics.metrics_include_partial_estimates);
        let (added, retained, dropped) = (
            metrics.added_tokens.expect("added"),
            metrics.retained_tokens.expect("retained"),
            metrics.dropped_tokens.expect("dropped"),
        );
        let union = (added + retained + dropped) as f64;
        assert_eq!(metrics.churn, Some((added + dropped) as f64 / union));
        assert_eq!(metrics.reuse, Some(retained as f64 / union));
        assert!(metrics.age.token_weighted_mean_age_calls.is_some());
    }
}

#[test]
fn session_subtotals_keep_recorded_values_and_count_unrecorded_calls() {
    let mut session = fake_session();
    let recorded = |input: u64, cost: f64| ReportedUsage {
        input: Some(input),
        output: Some(1),
        cache_read: Some(0),
        cache_write: Some(0),
        cost: ReportedCost {
            total: Some(cost),
            ..ReportedCost::default()
        },
        ..ReportedUsage::default()
    };
    let template = session.model_calls[0].clone();
    session.model_calls = (0..4).map(|_| template.clone()).collect();
    session.model_calls[0].reported_usage = recorded(10, 0.25);
    session.model_calls[1].reported_usage = ReportedUsage {
        placeholder: Some(PlaceholderUsage {
            cache_write_1h: None,
            reasoning: None,
            cost: ReportedCost::default(),
        }),
        ..ReportedUsage::default()
    };
    session.model_calls[2].reported_usage = ReportedUsage::default();
    session.model_calls[3].reported_usage = recorded(5, 0.5);

    let subtotals = session_usage_subtotals(&session.model_calls);
    assert_eq!(subtotals.prompt, Some(15));
    assert_eq!(subtotals.completion, Some(2));
    assert_eq!(subtotals.reasoning, None);
    assert_eq!(subtotals.cost, Some(0.75));
    let expected = RecordedCallCoverage {
        recorded_calls: 2,
        failed_attempt_calls: 1,
        missing_calls: 1,
    };
    assert_eq!(subtotals.usage_coverage, expected);
    assert_eq!(subtotals.cost_coverage, expected);

    session.model_calls[3].reported_usage = recorded(MAX_SAFE_JSON_INTEGER, 0.5);
    let overflowed = session_usage_subtotals(&session.model_calls);
    assert_eq!(
        overflowed.prompt, None,
        "overflow is unknown, not a lower bound"
    );
    assert_eq!(overflowed.usage_coverage, expected);
}

#[test]
fn session_pi_cost_total_rejects_negative_or_non_finite_values() {
    let mut session = fake_session();
    for invalid in [-0.01, f64::INFINITY] {
        session.model_calls[0].reported_usage.cost.total = Some(invalid);
        let subtotals = session_usage_subtotals(&session.model_calls);
        assert_eq!(subtotals.cost, None);
        assert_eq!(subtotals.cost_coverage.recorded_calls, 0);
        assert_eq!(subtotals.cost_coverage.missing_calls, 1);
    }
}

#[test]
fn api_omits_full_normalized_payload_records() {
    let analysis = analyze(
        fake_session(),
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("analysis");
    let json = serde_json::to_value(&analysis).expect("json");
    assert_eq!(json["schemaVersion"], ANALYSIS_SCHEMA_VERSION);
    assert_eq!(json["economics"]["costBasis"], "unknown");
    assert_eq!(
        json["modelCalls"][0]["economics"]["usageCompleteness"],
        "unsupported"
    );
    assert_eq!(
        json["modelCalls"][0]["economics"]["cacheRatioDiscontinuity"],
        serde_json::Value::Null
    );
    assert!(json["tokenAnalysis"].get("version").is_none());
    assert!(json["modelCalls"][0].get("contextItemTokens").is_none());
    assert!(json["modelCalls"][0].get("retainedItemIds").is_none());
    assert_eq!(json["modelCalls"][0]["transitionItemCounts"]["added"], 1);
    let items = json
        .get("contextItems")
        .and_then(serde_json::Value::as_array)
        .expect("context items");
    assert!(!items.is_empty());
    assert_eq!(items[0]["preview"]["text"], "hello world");
    assert_eq!(items[0]["preview"]["expandedText"], "hello world");
    assert_eq!(items[0]["preview"]["expandedTruncated"], false);
    assert!(items.iter().all(|item| {
        item["preview"]["expandedText"]
            .as_str()
            .is_some_and(|text| text.chars().count() <= 640)
    }));
    assert!(items.iter().all(|item| item.get("payload").is_none()));
    assert!(items.iter().all(|item| item.get("raw").is_none()));
    let profile_id = json["modelCalls"][0]["tokenizationProfileId"]
        .as_str()
        .expect("profile ID");
    assert_eq!(
        items[0]["tokenEstimates"]
            .as_array()
            .expect("estimates")
            .iter()
            .find(|estimate| estimate["profileId"] == profile_id)
            .and_then(|estimate| estimate["tokens"].as_u64()),
        Some(
            json["modelCalls"][0]["tokenAnalysis"]["calculatedVisibleTokens"]
                .as_u64()
                .expect("tokens")
        ),
    );
}

#[test]
fn long_payload_preview_omits_unbounded_suffix_from_api_json() {
    let omitted_suffix = "unique-omitted-preview-suffix";
    let mut session = fake_session();
    session.context_items[0].payload = TokenizationPayload::UserMessage(MessageContent::text(
        format!("visible\n{}\n{omitted_suffix}", "x".repeat(700)),
    ));
    let analysis = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("analysis");
    let json = serde_json::to_string(&analysis).expect("json");
    assert!(!json.contains(omitted_suffix));
    let preview = analysis.context_items[0].preview.as_ref().expect("preview");
    assert!(preview.expanded_truncated);
    assert!(preview.expanded_text.chars().count() <= 640);
}

#[test]
fn performance_diagnostics_do_not_change_serialized_analysis() {
    let without_diagnostics = analyze(
        fake_session(),
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("analysis without diagnostics");
    let with_diagnostics = analyze(
        fake_session(),
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: true,
            claude_code_billing: Default::default(),
        },
    )
    .expect("analysis with diagnostics");

    assert_eq!(
        serde_json::to_vec(&without_diagnostics).expect("analysis JSON"),
        serde_json::to_vec(&with_diagnostics).expect("analysis JSON")
    );
}

#[test]
fn recorded_output_is_exposed_without_changing_normalized_totals_costs_or_rates() {
    let original = fake_session();
    let mut recorded = original.clone();
    let usage = &mut recorded.model_calls[0].reported_usage;
    usage.recorded_output = Some(200);
    usage.reasoning = Some(50);
    usage.output_reasoning_relationship = OutputReasoningRelationship::Unknown;
    let config = AnalysisConfig {
        tokenization: TokenizationPolicy::Heuristic,
        perf_diagnostics: false,
        claude_code_billing: Default::default(),
    };
    let baseline = analyze(original, config).expect("baseline");
    let analysis = analyze(recorded, config).expect("recorded counters");
    let call = &analysis.model_calls[0];
    assert_eq!(call.usage.recorded_output, Some(200));
    assert_eq!(call.usage.reasoning, Some(50));
    assert_eq!(call.usage.output, None);
    assert_eq!(call.reported_completion_tokens, None);
    assert_eq!(call.cumulative_reported_completion_tokens, None);
    assert_eq!(analysis.session.reported_completion_tokens, None);
    assert_eq!(call.timing.effective_output_tokens_per_second, None);
    assert_eq!(
        serde_json::to_value(&analysis.economics).expect("economics"),
        serde_json::to_value(&baseline.economics).expect("baseline economics")
    );
    assert_eq!(
        serde_json::to_value(&call.token_analysis).expect("token analysis"),
        serde_json::to_value(&baseline.model_calls[0].token_analysis)
            .expect("baseline token analysis")
    );
}

#[test]
fn unsafe_recorded_output_is_rejected_independently_of_normalized_usage() {
    let mut session = fake_session();
    session.model_calls[0].reported_usage.recorded_output = Some(MAX_SAFE_JSON_INTEGER + 1);
    let error = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Off,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect_err("unsafe counter");
    assert!(error.to_string().contains("usage.recordedOutput"));
}

#[test]
fn zero_reported_prompt_is_not_divided() {
    let mut session = fake_session();
    session.model_calls[0].reported_usage = ReportedUsage {
        input: Some(0),
        cache_read: Some(0),
        cache_write: Some(0),
        ..ReportedUsage::default()
    };
    let analysis = analyze(
        session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        },
    )
    .expect("analysis");
    assert_eq!(
        analysis.model_calls[0].token_analysis.residual_percent,
        None
    );
}
