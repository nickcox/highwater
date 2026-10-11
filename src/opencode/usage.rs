//! Stored OpenCode accounting is not Pi accounting. A session's creation version
//! cannot select an output policy, because later versions can append to a session;
//! each record's own stored total can (see `evident_accounting`).

use crate::domain::{
    OutputReasoningRelationship, ReportedCost, ReportedUsage, MAX_SAFE_JSON_INTEGER,
};
use serde_json::Value;
use thiserror::Error;

#[derive(Debug, Clone, Copy)]
pub(crate) enum OutputAccounting {
    /// Audited v1.2.24/v1.3.10 getUsage: output already includes reasoning.
    IncludesReasoning,
    /// Audited v1.4.0 getUsage: output and reasoning are disjoint.
    ExcludesReasoning,
    /// Decide per record from its stored total (see `evident_accounting`); a
    /// record without that evidence is not given either interpretation.
    Unknown,
}

#[derive(Debug, Error)]
#[error("opencode usage contains invalid numbers")]
pub(crate) struct InvalidUsage;

fn count(value: Option<&Value>) -> Result<Option<u64>, InvalidUsage> {
    value
        .map(|value| {
            value
                .as_u64()
                .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
                .ok_or(InvalidUsage)
        })
        .transpose()
}

fn cost(value: Option<&Value>) -> Result<Option<f64>, InvalidUsage> {
    value
        .map(|value| {
            value
                .as_f64()
                .filter(|value| value.is_finite() && *value >= 0.0)
                .ok_or(InvalidUsage)
        })
        .transpose()
}

/// The overlap that a record's own `total` shows. OpenCode stores the provider's
/// total, which counts reasoning once: up to v1.3.x `output` already included
/// reasoning (total = input + output + cache), and from v1.4.0 `output` excludes it
/// (total = input + output + reasoning + cache). `evidence` is the record carrying
/// `total`; it must describe exactly the same counters as `tokens`, so a modern
/// record can use the legacy step it was copied from. Anything else, or a record
/// without reasoning (where overlap cannot matter), stays Unknown.
pub(crate) fn evident_accounting(
    tokens: Option<&Value>,
    evidence: Option<&Value>,
) -> OutputAccounting {
    const COUNTERS: [&str; 5] = [
        "/input",
        "/output",
        "/reasoning",
        "/cache/read",
        "/cache/write",
    ];
    let (Some(tokens), Some(evidence)) = (tokens, evidence) else {
        return OutputAccounting::Unknown;
    };
    if COUNTERS
        .iter()
        .any(|pointer| tokens.pointer(pointer) != evidence.pointer(pointer))
    {
        return OutputAccounting::Unknown;
    }
    let value = |pointer: &str| evidence.pointer(pointer).and_then(Value::as_u64);
    let (Some(total), Some(input), Some(output), Some(reasoning), Some(read), Some(write)) = (
        value("/total"),
        value("/input"),
        value("/output"),
        value("/reasoning"),
        value("/cache/read"),
        value("/cache/write"),
    ) else {
        return OutputAccounting::Unknown;
    };
    if reasoning == 0 {
        return OutputAccounting::Unknown;
    }
    let without_reasoning = input
        .checked_add(output)
        .and_then(|sum| sum.checked_add(read))
        .and_then(|sum| sum.checked_add(write));
    match without_reasoning {
        Some(sum) if total == sum => OutputAccounting::IncludesReasoning,
        Some(sum) if Some(total) == sum.checked_add(reasoning) => {
            OutputAccounting::ExcludesReasoning
        }
        _ => OutputAccounting::Unknown,
    }
}

/// `measured` means a completed step supplied this usage, not simply that the
/// assistant record was finalized. Error/initialized records often contain zero.
/// Raw stored JSON stays in the source snapshot; no values are inferred from a
/// today's pricing, session aggregates, or local tokenizer estimates.
pub(crate) fn normalize(
    tokens: Option<&Value>,
    stored_cost: Option<&Value>,
    measured: bool,
    policy: OutputAccounting,
) -> Result<ReportedUsage, InvalidUsage> {
    let tokens = match tokens {
        Some(tokens) if tokens.is_object() => Some(tokens),
        Some(_) => return Err(InvalidUsage),
        None => None,
    };
    let cache = tokens.and_then(|tokens| tokens.get("cache"));
    if cache.is_some_and(|value| !value.is_object()) {
        return Err(InvalidUsage);
    }
    let input = count(tokens.and_then(|tokens| tokens.get("input")))?;
    let output = count(tokens.and_then(|tokens| tokens.get("output")))?;
    let reasoning = count(tokens.and_then(|tokens| tokens.get("reasoning")))?;
    let cache_read = count(cache.and_then(|cache| cache.get("read")))?;
    let cache_write = count(cache.and_then(|cache| cache.get("write")))?;
    let total_tokens = count(tokens.and_then(|tokens| tokens.get("total")))?;
    let total_cost = cost(stored_cost)?;
    // Validate even unmeasured records. Malformed numbers do not become absent.
    if !measured {
        return Ok(ReportedUsage::default());
    }
    let recorded_output = output;
    let output_reasoning_relationship = match policy {
        OutputAccounting::IncludesReasoning => OutputReasoningRelationship::IncludesReasoning,
        OutputAccounting::ExcludesReasoning => OutputReasoningRelationship::ExcludesReasoning,
        OutputAccounting::Unknown => OutputReasoningRelationship::Unknown,
    };
    let output = match policy {
        OutputAccounting::IncludesReasoning => {
            if matches!((output, reasoning), (Some(output), Some(reasoning)) if reasoning > output)
            {
                return Err(InvalidUsage);
            }
            output
        }
        OutputAccounting::ExcludesReasoning => match (output, reasoning) {
            (Some(output), Some(reasoning)) => output
                .checked_add(reasoning)
                .filter(|value| *value <= MAX_SAFE_JSON_INTEGER),
            _ => None,
        },
        OutputAccounting::Unknown => match reasoning {
            Some(0) => output,
            _ => None,
        },
    };
    Ok(ReportedUsage {
        input,
        output,
        recorded_output,
        output_reasoning_relationship,
        reasoning,
        cache_read,
        cache_write,
        total_tokens,
        // Source stores total cost, not an audited per-bucket breakdown.
        cost: ReportedCost {
            total: total_cost,
            ..ReportedCost::default()
        },
        ..ReportedUsage::default()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn older_and_newer_output_policies_include_reasoning_exactly_once() {
        let old = json!({"input":80,"output":30,"reasoning":10,"cache":{"read":20,"write":5},"total":135});
        let new = json!({"input":80,"output":20,"reasoning":10,"cache":{"read":20,"write":5},"total":135});
        for (tokens, policy) in [
            (&old, OutputAccounting::IncludesReasoning),
            (&new, OutputAccounting::ExcludesReasoning),
        ] {
            let usage = normalize(Some(tokens), Some(&json!(0.25)), true, policy).expect("usage");
            assert_eq!(usage.output, Some(30));
            assert_eq!(usage.recorded_output, tokens["output"].as_u64());
            assert_eq!(
                usage.output_reasoning_relationship,
                match policy {
                    OutputAccounting::IncludesReasoning =>
                        OutputReasoningRelationship::IncludesReasoning,
                    OutputAccounting::ExcludesReasoning =>
                        OutputReasoningRelationship::ExcludesReasoning,
                    OutputAccounting::Unknown => unreachable!("audited vectors"),
                }
            );
            assert_eq!(usage.reasoning, Some(10));
            assert_eq!(
                (
                    usage.input,
                    usage.cache_read,
                    usage.cache_write,
                    usage.total_tokens
                ),
                (Some(80), Some(20), Some(5), Some(135))
            );
            assert_eq!(usage.cost.total, Some(0.25));
            assert!(usage.cost.input.is_none());
        }
    }

    #[test]
    fn stored_total_decides_overlap_only_when_it_fits_exactly_one_layout() {
        let record = |total: Value| json!({"input":80,"output":20,"reasoning":10,"cache":{"read":20,"write":5},"total":total});
        let evident = |tokens: &Value| evident_accounting(Some(tokens), Some(tokens));
        // 80 + 20 + 20 + 5 = 125, plus 10 reasoning = 135.
        assert!(matches!(
            evident(&record(json!(125))),
            OutputAccounting::IncludesReasoning
        ));
        assert!(matches!(
            evident(&record(json!(135))),
            OutputAccounting::ExcludesReasoning
        ));
        for unexplained in [json!(130), json!(null), json!("135")] {
            assert!(matches!(
                evident(&record(unexplained)),
                OutputAccounting::Unknown
            ));
        }
        let no_reasoning =
            json!({"input":1,"output":2,"reasoning":0,"cache":{"read":0,"write":0},"total":3});
        assert!(matches!(evident(&no_reasoning), OutputAccounting::Unknown));
        let no_cache = json!({"input":80,"output":20,"reasoning":10,"total":110});
        assert!(matches!(evident(&no_cache), OutputAccounting::Unknown));
        // Evidence must describe the same counters as the record it qualifies.
        let other = json!({"input":81,"output":20,"reasoning":10,"cache":{"read":20,"write":5},"total":136});
        assert!(matches!(
            evident_accounting(Some(&record(json!(135))), Some(&other)),
            OutputAccounting::Unknown
        ));
        assert!(matches!(
            evident_accounting(Some(&record(json!(135))), None),
            OutputAccounting::Unknown
        ));
    }

    #[test]
    fn unknown_writer_does_not_guess_output_reasoning_overlap() {
        let tokens = json!({"input":1,"output":20,"reasoning":10,"cache":{"read":0,"write":0}});
        let usage = normalize(Some(&tokens), None, true, OutputAccounting::Unknown).expect("usage");
        assert_eq!(usage.output, None);
        assert_eq!(usage.recorded_output, Some(20));
        assert_eq!(
            usage.output_reasoning_relationship,
            OutputReasoningRelationship::Unknown
        );
        assert_eq!(usage.reasoning, Some(10));
        let zero = json!({"output":20,"reasoning":0});
        assert_eq!(
            normalize(Some(&zero), None, true, OutputAccounting::Unknown)
                .expect("zero reasoning")
                .output,
            Some(20)
        );
    }

    #[test]
    fn initialized_zero_and_measured_zero_remain_distinct() {
        let tokens = json!({"input":0,"output":0,"reasoning":0,"cache":{"read":0,"write":0}});
        let missing = normalize(
            Some(&tokens),
            Some(&json!(0)),
            false,
            OutputAccounting::Unknown,
        )
        .expect("initialized");
        assert!(missing.input.is_none());
        assert!(missing.recorded_output.is_none());
        assert!(missing.reasoning.is_none());
        assert!(missing.cost.total.is_none());
        let measured = normalize(
            Some(&tokens),
            Some(&json!(0)),
            true,
            OutputAccounting::Unknown,
        )
        .expect("measured");
        assert_eq!(measured.input, Some(0));
        assert_eq!(measured.output, Some(0));
        assert_eq!(measured.recorded_output, Some(0));
        assert_eq!(measured.cost.total, Some(0.0));
    }

    #[test]
    fn missing_buckets_are_not_filled_from_totals() {
        let tokens = json!({"input":5,"total":999});
        let usage =
            normalize(Some(&tokens), None, true, OutputAccounting::Unknown).expect("partial");
        assert_eq!(usage.input, Some(5));
        assert_eq!(usage.total_tokens, Some(999));
        assert!(usage.output.is_none());
        assert!(usage.recorded_output.is_none());
        assert!(usage.cache_read.is_none());
        assert!(usage.reasoning.is_none());
    }

    #[test]
    fn malformed_negative_fractional_and_unsafe_numbers_are_rejected() {
        for bad in [
            json!(-1),
            json!(1.5),
            json!("5"),
            json!(null),
            json!(9_007_199_254_740_992_u64),
        ] {
            for path in ["input", "output", "reasoning", "total"] {
                let mut tokens = json!({});
                tokens[path] = bad.clone();
                assert!(normalize(Some(&tokens), None, false, OutputAccounting::Unknown).is_err());
            }
            let tokens = json!({"cache":{"read":bad}});
            assert!(normalize(Some(&tokens), None, true, OutputAccounting::Unknown).is_err());
        }
        for tokens in [json!([]), json!({"cache":[]})] {
            assert!(normalize(Some(&tokens), None, true, OutputAccounting::Unknown).is_err());
        }
        assert!(normalize(None, Some(&json!(-0.5)), false, OutputAccounting::Unknown).is_err());
        assert!(normalize(
            Some(&json!({"output":2,"reasoning":3})),
            None,
            true,
            OutputAccounting::IncludesReasoning
        )
        .is_err());
    }

    #[test]
    fn derived_output_overflow_is_unavailable_not_a_subtotal() {
        let tokens = json!({"output":MAX_SAFE_JSON_INTEGER,"reasoning":1});
        let usage = normalize(
            Some(&tokens),
            None,
            true,
            OutputAccounting::ExcludesReasoning,
        )
        .expect("valid source fields");
        assert!(usage.output.is_none());
        assert_eq!(usage.recorded_output, Some(MAX_SAFE_JSON_INTEGER));
        assert_eq!(
            usage.output_reasoning_relationship,
            OutputReasoningRelationship::ExcludesReasoning
        );
        assert_eq!(usage.reasoning, Some(1));
    }
}
