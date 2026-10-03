//! Test-only normalized inputs and controlled estimates. Derivation and serialization
//! still use the production pipeline; injecting tiny numeric observations avoids huge payloads.

use super::*;

pub(super) fn fake_session() -> NormalizedSession {
    let item = NormalizedContextItem {
        id: "opaque-item".into(),
        kind: ContextItemKind::UserMessage,
        label: "user".into(),
        source_record_id: Some("record".into()),
        source_tool_call_id: None,
        metadata: BTreeMap::new(),
        serialized_size_bytes: 20,
        payload: TokenizationPayload::UserMessage(MessageContent::text("hello world")),
        presence: vec![PresenceRange {
            start_call: 1,
            end_call: 1,
        }],
        first_model_call: 1,
        last_model_call: 1,
    };
    NormalizedSession {
        id: "fake".into(),
        source: SourceDescriptor {
            kind: "fake".into(),
            version: "1".into(),
            cost_basis: CostBasis::Unknown,
        },
        title: None,
        working_directory: None,
        context_items: vec![item],
        model_calls: vec![NormalizedModelCall {
            index: 1,
            source_record_id: "call".into(),
            target: ModelTarget {
                provider: Some("unknown".into()),
                model: Some("unknown".into()),
                api: None,
            },
            reported_usage: ReportedUsage::default(),
            stop_reason: None,
            context_item_ids: vec!["opaque-item".into()],
            tool_calls_after: vec![],
            compaction_before: None,
        }],
        compactions: vec![],
        lineage: vec![],
    }
}

pub(super) fn analysis_with_controlled_estimates(
    session: &NormalizedSession,
    per_call_tokens: &[Vec<Option<u64>>],
) -> Analysis {
    let config = AnalysisConfig {
        tokenization: TokenizationPolicy::Heuristic,
        perf_diagnostics: false,
    };
    let validated = validate_normalized_session(session).expect("valid synthetic session");
    let mut prepared = preparation::prepare(session, &validated, config);
    assert_eq!(prepared.works.len(), per_call_tokens.len());
    let mut injected = HashSet::new();
    for (work, tokens) in prepared.works.iter().zip(per_call_tokens) {
        assert_eq!(work.estimate_indexes.len(), tokens.len());
        for (index, tokens) in work.estimate_indexes.iter().zip(tokens) {
            // Distinct profiles/payloads keep every observation independently controlled.
            assert!(
                injected.insert(*index),
                "controlled estimates must not alias"
            );
            assert!(tokens.is_none_or(|value| value <= MAX_SAFE_JSON_INTEGER));
            let estimate = prepared.registry.estimate_at_mut(*index);
            estimate.tokens = *tokens;
            estimate.coverage = if tokens.is_some() {
                TokenCoverage::Complete
            } else {
                TokenCoverage::Unavailable
            };
        }
    }
    let calls = derive_calls(session, &prepared);
    let items = derive_items(session, &prepared);
    assemble_analysis(
        session,
        config,
        &prepared,
        calls,
        items,
        Instant::now(),
        0.0,
    )
}
