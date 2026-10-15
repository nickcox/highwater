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

/// Pins every Pi fixture's output under each tokenization policy, so a change that alters any
/// output fails here. When an output changes on purpose, update the digest and say why in the
/// commit message.
#[test]
fn fixture_outputs_match_pinned_digest() {
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
            let json = serde_json::to_string(&output).expect("JSON");
            digest.update(&(json.len() as u64).to_le_bytes());
            digest.update(json.as_bytes());
        }
    }
    assert_eq!(
        digest.finalize().to_hex().as_str(),
        "6496455a11c608ea8fade50c59356c9f42f01bfa9b60ab85869516fcd3855b80"
    );
}
