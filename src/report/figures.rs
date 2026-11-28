//! Compact session accounting, using the same dated prices as item costs.
use super::{
    build::ItemCost,
    types::{ContextBand, RewriteTotal, SessionReport},
};
use crate::{api::Analysis, domain::NormalizedSession, pricing::InputPrice};
use serde_json::{json, Value};

fn add(total: &mut Option<f64>, value: Option<f64>) {
    if let Some(value) = value {
        *total = Some(total.unwrap_or(0.0) + value);
    }
}
pub(super) fn rounded(value: Option<f64>) -> Option<f64> {
    value.map(|v| (v * 10_000.0).round() / 10_000.0)
}
fn empty_bands() -> Vec<ContextBand> {
    ["<50K", "50–100K", "100–200K", "200–400K", ">=400K"]
        .into_iter()
        .map(|prompt| ContextBand {
            prompt,
            ..Default::default()
        })
        .collect()
}
pub(super) fn bands(analysis: &Analysis) -> Vec<ContextBand> {
    let mut bands = empty_bands();
    for call in &analysis.model_calls {
        if let Some(prompt) = call.reported_prompt_tokens {
            let index =
                [50_000, 100_000, 200_000, 400_000].partition_point(|limit| prompt >= *limit);
            bands[index].calls += 1;
            add(&mut bands[index].usd, call.cost_assessment.amount);
        }
    }
    bands
}
pub(super) fn sum_bands(sessions: &[SessionReport]) -> Vec<ContextBand> {
    let mut result = empty_bands();
    for session in sessions {
        for (total, band) in result.iter_mut().zip(&session.cost_by_context_size) {
            total.calls += band.calls;
            add(&mut total.usd, band.usd);
        }
    }
    result
}
pub(super) fn rewrites(analysis: &Analysis) -> RewriteTotal {
    let lifetime = if analysis
        .model_calls
        .iter()
        .any(|c| c.usage.cache_write_1h.unwrap_or(0) > 0)
    {
        3_600_000
    } else {
        300_000
    };
    let mut result = RewriteTotal::default();
    for pair in analysis.model_calls.windows(2) {
        let (previous, call) = (&pair[0], &pair[1]);
        if matches!(
            call.stop_reason.as_deref(),
            Some("compaction-call" | "compaction-aggregate")
        ) || analysis
            .compactions
            .iter()
            .any(|c| c.details.summary_call == Some(call.index))
        {
            continue;
        }
        let (Some(prompt), Some(written)) = (call.reported_prompt_tokens, call.usage.cache_write)
        else {
            continue;
        };
        if prompt < 20_000 || written < prompt.div_ceil(2) {
            continue;
        }
        let pause = previous
            .timing
            .recorded_at_ms
            .zip(call.timing.started_at_ms.or(call.timing.recorded_at_ms))
            .map(|(end, start)| start - end);
        result.calls += 1;
        result.after_expiry += usize::from(pause.is_some_and(|p| p > lifetime));
        add(&mut result.usd, call.cost_assessment.amount);
        result.largest.push(json!({"call": call.index, "tokens": written, "usd": rounded(call.cost_assessment.amount), "breakSeconds": pause.map(|ms| ms / 1000)}));
    }
    result
        .largest
        .sort_by_key(|v| std::cmp::Reverse(v["tokens"].as_u64()));
    result.largest.truncate(5);
    result
}
pub(super) fn sum_rewrites(sessions: &[SessionReport]) -> RewriteTotal {
    let mut result = RewriteTotal::default();
    for session in sessions {
        result.calls += session.cache_rewrites.calls;
        result.after_expiry += session.cache_rewrites.after_expiry;
        add(&mut result.usd, session.cache_rewrites.usd);
    }
    result
}
pub(super) fn input(
    analysis: &Analysis,
    normalized: &NormalizedSession,
    prices: &[Option<InputPrice>],
) -> Value {
    let mut tokens = [None; 4];
    let mut dollars = [None; 4];
    let mut uncached = Vec::new();
    for ((call, source), price) in analysis
        .model_calls
        .iter()
        .zip(&normalized.model_calls)
        .zip(prices)
    {
        let u = &source.reported_usage;
        let counts = [u.input, u.cache_read, u.cache_write, u.output];
        if let Some(n) = u.input {
            uncached.push(n);
        }
        for (total, count) in tokens.iter_mut().zip(counts) {
            if let Some(n) = count {
                *total = Some(total.unwrap_or(0u64) + n);
            }
        }
        let recorded = [
            u.cost.input,
            u.cost.cache_read,
            u.cost.cache_write,
            u.cost.output,
        ];
        let estimated = price
            .map(|p| {
                let raw = [
                    u.input.map(|n| n as f64 * p.input),
                    u.cache_read.map(|n| n as f64 * p.cache_read),
                    u.cache_write.map(|n| n as f64 * p.cache_write),
                    p.output_cost,
                ];
                // Preserve long-context and cache-lifetime pricing in the prompt total.
                let sum: f64 = raw[..3].iter().flatten().sum();
                let scale = p
                    .prompt_cost
                    .filter(|_| sum > 0.0)
                    .map_or(1.0, |cost| cost / sum);
                [
                    raw[0].map(|v| v * scale),
                    raw[1].map(|v| v * scale),
                    raw[2].map(|v| v * scale),
                    raw[3],
                ]
            })
            .unwrap_or([None; 4]);
        let complete_recorded = recorded.iter().all(Option::is_some);
        let mut amounts = if complete_recorded {
            recorded
        } else {
            estimated
        };
        let sum: f64 = amounts.iter().flatten().sum();
        if let Some(total) = call
            .cost_assessment
            .amount
            .filter(|_| sum > 0.0 && !complete_recorded)
        {
            for amount in amounts.iter_mut().flatten() {
                *amount *= total / sum;
            }
        }
        for (total, amount) in dollars.iter_mut().zip(amounts) {
            add(total, amount);
        }
    }
    uncached.sort_unstable();
    let median = if uncached.is_empty() {
        None
    } else {
        let lower = uncached[(uncached.len() - 1) / 2];
        let upper = uncached[uncached.len() / 2];
        Some(lower + (upper - lower) / 2)
    };
    let mut result = json!({"medianUncached": median, "largestUncached": uncached.last()});
    for (i, name) in ["uncached", "cacheRead", "cacheWrite", "output"]
        .iter()
        .enumerate()
    {
        result[name] = json!({"tokens": tokens[i], "usd": rounded(dollars[i])});
    }
    result
}
pub(super) fn items(analysis: &Analysis, costs: &[ItemCost]) -> Vec<Value> {
    let mut items: Vec<_> = analysis.context_items.iter().zip(costs).collect();
    items.sort_by(|a, b| {
        b.1.cost
            .usd
            .partial_cmp(&a.1.cost.usd)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    items.into_iter().take(10).map(|(item,cost)| json!({"id": item.id, "kind": item.kind, "label": item.label.chars().take(80).collect::<String>(), "tokens": cost.tokens, "calls": cost.present_calls, "firstCall": cost.first_call, "usd": rounded(cost.cost.usd)})).collect()
}

/// Turn costs use whole-call costs; missing costs do not contribute to the sum.
pub(super) fn turns(
    analysis: &Analysis,
) -> (
    std::collections::BTreeMap<String, super::types::StarterTotal>,
    Vec<Value>,
) {
    let mut totals = std::collections::BTreeMap::<String, super::types::StarterTotal>::new();
    let mut expensive = Vec::new();
    for (index, turn) in super::build::report_turns(analysis).iter().enumerate() {
        let calls = &analysis.model_calls[turn.first_call - 1..turn.last_call];
        let mut cost = None;
        for call in calls {
            add(&mut cost, call.cost_assessment.amount);
        }
        let total = totals.entry(turn.starter.into()).or_default();
        total.turns += 1;
        total.calls += calls.len();
        add(&mut total.usd, cost);
        let first = &calls[0];
        let pause = turn
            .first_call
            .checked_sub(2)
            .and_then(|i| analysis.model_calls[i].timing.recorded_at_ms)
            .zip(first.timing.started_at_ms.or(first.timing.recorded_at_ms))
            .map(|(end, start)| (start - end) / 1000);
        expensive.push((cost, json!({"turn": index + 1, "firstCall": turn.first_call, "lastCall": turn.last_call,
            "usd": rounded(cost), "breakSeconds": pause, "firstPromptTokens": first.reported_prompt_tokens,
            "lastPromptTokens": calls.last().unwrap().reported_prompt_tokens, "starter": turn.starter,
            "prompt": turn.prompt.map(|p| p.chars().take(80).collect::<String>())})));
    }
    expensive.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    (
        totals,
        expensive
            .into_iter()
            .take(3)
            .map(|(_, value)| value)
            .collect(),
    )
}

pub(super) fn sum_turns(
    sessions: &[SessionReport],
) -> std::collections::BTreeMap<String, super::types::StarterTotal> {
    let mut result = std::collections::BTreeMap::<String, super::types::StarterTotal>::new();
    for session in sessions {
        for (starter, total) in &session.turns_by_starter {
            let sum = result.entry(starter.clone()).or_default();
            sum.turns += total.turns;
            sum.calls += total.calls;
            add(&mut sum.usd, total.usd);
        }
    }
    result
}
