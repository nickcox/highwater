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
                    call.as_object_mut().expect("call").remove("timing");
                }
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
            let mut json = serde_json::to_string(&baseline).expect("JSON");
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
            digest.update(&(json.len() as u64).to_le_bytes());
            digest.update(json.as_bytes());
        }
    }
    assert_eq!(
        digest.finalize().to_hex().as_str(),
        // Schema 8 adds per-call wall-clock/timing metadata. Above, all other
        // fields are identical with and without clocks for every fixture/policy.
        "205304ac73432888acb9996d4ac89fd91aab0b9b5427da11ec09e718a06ae5c8"
    );
}
