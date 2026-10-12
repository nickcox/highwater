use super::*;
use crate::{domain::SessionSourceAdapter, pi::PiSourceAdapter};
use std::{fs::File, io::BufReader};

#[test]
fn transitions_borrow_source_ids_in_context_order() {
    let mut reader = BufReader::new(File::open("fixtures/pi/compaction.jsonl").expect("fixture"));
    let session = PiSourceAdapter
        .parse(&mut reader)
        .expect("normalized fixture");
    let validated = validate_normalized_session(&session).expect("valid fixture");
    let prepared = preparation::prepare(
        &session,
        &validated,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
        },
        ProfileRegistry::default(),
    );
    for (position, transition) in prepared.transitions.iter().enumerate() {
        let current = &session.model_calls[position].context_item_ids;
        let previous = position
            .checked_sub(1)
            .map(|index| session.model_calls[index].context_item_ids.as_slice())
            .unwrap_or(&[]);
        let added = current
            .iter()
            .filter(|id| !previous.contains(id))
            .map(String::as_str)
            .collect::<Vec<_>>();
        let retained = current
            .iter()
            .filter(|id| previous.contains(id))
            .map(String::as_str)
            .collect::<Vec<_>>();
        let dropped = previous
            .iter()
            .filter(|id| !current.contains(id))
            .map(String::as_str)
            .collect::<Vec<_>>();
        assert_eq!(transition.added_ids, added);
        assert_eq!(transition.retained_ids, retained);
        assert_eq!(transition.dropped_ids, dropped);
        for id in transition.added_ids.iter().chain(&transition.retained_ids) {
            let source = current
                .iter()
                .find(|source| source.as_str() == *id)
                .expect("current source ID");
            assert!(std::ptr::eq(*id, source.as_str()));
        }
        for id in &transition.dropped_ids {
            let source = previous
                .iter()
                .find(|source| source.as_str() == *id)
                .expect("previous source ID");
            assert!(std::ptr::eq(*id, source.as_str()));
        }
    }
}

#[test]
fn fixture_outputs_preserve_corrected_baseline() {
    let mut digest = blake3::Hasher::new();
    for fixture in [
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
        for policy in [
            TokenizationPolicy::Auto,
            TokenizationPolicy::Strict,
            TokenizationPolicy::Heuristic,
            TokenizationPolicy::Off,
        ] {
            let mut reader = BufReader::new(
                File::open(format!("fixtures/pi/{fixture}.jsonl")).expect("fixture"),
            );
            let session = PiSourceAdapter
                .parse(&mut reader)
                .expect("normalized fixture");
            let validated = validate_normalized_session(&session).expect("valid fixture");
            let prepared = preparation::prepare(
                &session,
                &validated,
                AnalysisConfig {
                    tokenization: policy,
                    perf_diagnostics: false,
                },
                ProfileRegistry::default(),
            );
            let stats = prepared.registry.stats();
            let planned_pairs = prepared
                .item_estimates
                .iter()
                .map(BTreeMap::len)
                .sum::<usize>();
            assert_eq!(
                stats.payloads_fingerprinted,
                session.context_items.len() as u64
            );
            assert_eq!(stats.estimate_lookups, planned_pairs as u64);
            assert!(stats.tokenizer_invocations <= stats.unique_estimates);
            drop(prepared);
            let mut with_clocks = session.clone();
            for call in &mut with_clocks.model_calls {
                call.timestamps = CallTimestamps {
                    started_at_ms: Some(1_700_000_000_000),
                    recorded_at_ms: Some(1_700_000_002_000),
                };
            }
            let output = analyze(
                session,
                AnalysisConfig {
                    tokenization: policy,
                    perf_diagnostics: false,
                },
            )
            .expect("analysis");
            let timed = analyze(
                with_clocks,
                AnalysisConfig {
                    tokenization: policy,
                    perf_diagnostics: false,
                },
            )
            .expect("timed analysis");
            let strip = |analysis: &Analysis| {
                let mut value = serde_json::to_value(analysis).expect("JSON");
                for call in value["modelCalls"].as_array_mut().expect("calls") {
                    let call = call.as_object_mut().expect("call");
                    call.remove("timing");
                    // A cost is priced by the call's time, so it depends on the clock too.
                    call.remove("costAssessment");
                }
                value["session"]
                    .as_object_mut()
                    .expect("session")
                    .remove("costSummary");
                value
            };
            assert_eq!(
                strip(&output),
                strip(&timed),
                "timing changed non-timing fields: {fixture}"
            );
            // Keep the schema-8 metric baseline pinned. Schema 9 adds optional
            // reconstruction coverage (absent for Pi), and schema 10 adds two
            // recorded-counter fields without changing normalized math.
            let mut baseline = output.clone();
            baseline.schema_version = 8;
            // Output 22 reports session subtotals with coverage. Map them back to
            // the earlier all-or-nothing totals so every other field stays pinned.
            let calls = &baseline.model_calls;
            let all_calls = |count: usize| !calls.is_empty() && count == calls.len();
            let session = &mut baseline.session;
            if !all_calls(session.reported_usage_coverage.recorded_calls) {
                session.reported_prompt_tokens = None;
            }
            if !calls.iter().all(|call| call.usage.output.is_some()) {
                session.reported_completion_tokens = None;
            }
            if !calls.iter().all(|call| call.usage.reasoning.is_some()) {
                session.reported_reasoning_tokens = None;
            }
            if !all_calls(session.reported_cost_coverage.recorded_calls) {
                session.reported_cost_total = None;
            }
            let mut json = serde_json::to_string(&baseline).expect("JSON");
            // Schema 12 sends per-call item positions instead of item IDs; restore
            // the ID lists so the pinned digest still covers the same references.
            for call in &baseline.model_calls {
                let ids = |indexes: &[usize]| {
                    serde_json::to_string(
                        &indexes
                            .iter()
                            .map(|index| baseline.context_items[*index].id.as_str())
                            .collect::<Vec<_>>(),
                    )
                    .expect("IDs")
                };
                let positions =
                    |indexes: &[usize]| serde_json::to_string(indexes).expect("indexes");
                let current = format!(
                    "\"contextItemIndexes\":{},\"addedItemIndexes\":{},\"droppedItemIndexes\":{}",
                    positions(&call.context_item_indexes),
                    positions(&call.added_item_indexes),
                    positions(&call.dropped_item_indexes),
                );
                let previous = format!(
                    "\"contextItemIds\":{},\"addedItemIds\":{},\"droppedItemIds\":{}",
                    ids(&call.context_item_indexes),
                    ids(&call.added_item_indexes),
                    ids(&call.dropped_item_indexes),
                );
                let at = json.find(&current).expect("call item positions serialized");
                json.replace_range(at..at + current.len(), &previous);
            }
            for (field, coverage) in [
                (
                    "reportedCostCoverage",
                    &baseline.session.reported_cost_coverage,
                ),
                (
                    "reportedUsageCoverage",
                    &baseline.session.reported_usage_coverage,
                ),
            ] {
                let addition = format!(
                    "\"{field}\":{},",
                    serde_json::to_string(coverage).expect("coverage")
                );
                assert!(json.contains(&addition), "{field} serialized once");
                json = json.replacen(&addition, "", 1);
            }
            assert!(baseline
                .model_calls
                .iter()
                .all(|call| call.usage.placeholder.is_none()));
            json = json.replace("\"placeholder\":null,", "");
            for call in &baseline.model_calls {
                assert_eq!(call.usage.recorded_output, call.usage.output);
                // Remove exactly the additive fields in struct serialization
                // order; strings in previews are JSON-escaped and cannot match.
                let addition = format!(
                    "\"recordedOutput\":{},\"outputReasoningRelationship\":{},",
                    serde_json::to_string(&call.usage.recorded_output).expect("counter"),
                    serde_json::to_string(&call.usage.output_reasoning_relationship)
                        .expect("relationship"),
                );
                json = json.replace(&addition, "");
            }
            // Output 24 adds per-call cost assessments and the session cost summary,
            // each serialized last in its object.
            for call in &baseline.model_calls {
                let addition = format!(
                    ",\"costAssessment\":{}",
                    serde_json::to_string(&call.cost_assessment).expect("assessment")
                );
                assert!(json.contains(&addition), "cost assessment serialized");
                json = json.replacen(&addition, "", 1);
            }
            let addition = format!(
                ",\"costSummary\":{}",
                serde_json::to_string(&baseline.session.cost_summary).expect("summary")
            );
            assert!(json.contains(&addition), "cost summary serialized");
            json = json.replacen(&addition, "", 1);
            // Output 26 adds the harness's own session total, null for Pi.
            assert!(baseline.session.harness_session_cost.is_none());
            let addition = ",\"harnessSessionCost\":null";
            assert!(json.contains(addition), "harness session cost serialized");
            json = json.replacen(addition, "", 1);
            digest.update(&(json.len() as u64).to_le_bytes());
            digest.update(json.as_bytes());
        }
    }
    assert_eq!(
        digest.finalize().to_hex().as_str(),
        // Schema 8 adds per-call wall-clock/timing metadata. Above, all other
        // fields are identical with and without clocks for every fixture/policy.
        // Output 23 computes transition and age metrics from partial estimates
        // too and adds `metricsIncludePartialEstimates`; with those fields
        // removed, the output hashed identically before and after that change.
        // Output 27 replaces the character estimate for Claude models with calibrated
        // o200k counts. Only economics-policies.jsonl has a Claude target
        // (`claude-test`); comparing main and this change for every Pi fixture, only
        // that profile and the estimates and metrics derived from it differ.
        // Output 29 counts Claude models with the ctok port instead; again only the
        // `claude-test` profile and what derives from it differ from output 28.
        "20ceadee3d122835433a3033a70b329ea6698d4262f913c4bb61f2f5a859c57a"
    );
}
