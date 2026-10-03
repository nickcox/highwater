use crate::api::CallAgeMetrics;
use crate::domain::{NormalizedContextItem, MAX_SAFE_JSON_INTEGER};
use std::collections::{BTreeMap, HashMap};

#[derive(Debug, Clone, Copy)]
pub(crate) struct TransitionMetrics {
    pub added: Option<u64>,
    pub retained: Option<u64>,
    pub dropped: Option<u64>,
    pub churn: Option<f64>,
    pub reuse: Option<f64>,
    pub addition_share: Option<f64>,
    pub removal_share: Option<f64>,
}

pub(crate) fn calculate_transition(
    added_ids: &[&str],
    retained_ids: &[&str],
    dropped_ids: &[&str],
    previous_ids: &[String],
    current_ids: &[String],
    tokens: &BTreeMap<&str, Option<u64>>,
) -> TransitionMetrics {
    let added = sum_ids(added_ids, tokens);
    let retained = sum_ids(retained_ids, tokens);
    let dropped = sum_ids(dropped_ids, tokens);
    let union = match (added, retained, dropped) {
        (Some(added), Some(retained), Some(dropped)) => added
            .checked_add(retained)
            .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
            .and_then(|value| value.checked_add(dropped))
            .filter(|value| *value <= MAX_SAFE_JSON_INTEGER),
        _ => None,
    };
    let (churn, reuse) = union
        .filter(|value| *value > 0)
        .and_then(|union| {
            let added = added?;
            let retained = retained?;
            let dropped = dropped?;
            let changed = added.checked_add(dropped)?;
            let union = union as f64;
            Some((changed as f64 / union, retained as f64 / union))
        })
        .map_or((None, None), |(churn, reuse)| (Some(churn), Some(reuse)));
    let current_total = sum_ids(current_ids, tokens);
    let previous_total = sum_ids(previous_ids, tokens);
    TransitionMetrics {
        added,
        retained,
        dropped,
        churn,
        reuse,
        addition_share: match (added, current_total) {
            (Some(added), Some(total)) if total > 0 => Some(added as f64 / total as f64),
            _ => None,
        },
        removal_share: match (dropped, previous_total) {
            (Some(dropped), Some(total)) if total > 0 => Some(dropped as f64 / total as f64),
            _ => None,
        },
    }
}

pub(crate) fn calculate_age(
    context_ids: &[String],
    items: &HashMap<&str, &NormalizedContextItem>,
    tokens: &BTreeMap<&str, Option<u64>>,
    call_index: usize,
) -> CallAgeMetrics {
    let ages: Vec<usize> = context_ids
        .iter()
        .filter_map(|id| {
            items
                .get(id.as_str())
                .and_then(|item| item.lifetime()?.age_at(call_index))
        })
        .collect();
    let oldest = ages.iter().copied().max();
    let median = median_usize(&ages);
    let mut weighted_numerator = Some(0_u128);
    let mut weighted_denominator = Some(0_u128);
    let mut threshold_totals = [Some(0_u64), Some(0_u64), Some(0_u64)];
    let mut threshold_counts = [0_usize; 3];
    for id in context_ids {
        let Some(item) = items.get(id.as_str()) else {
            continue;
        };
        let Some(age) = item
            .lifetime()
            .and_then(|lifetime| lifetime.age_at(call_index))
        else {
            weighted_numerator = None;
            weighted_denominator = None;
            threshold_totals = [None, None, None];
            continue;
        };
        for (slot, threshold) in [5, 10, 20].into_iter().enumerate() {
            if age >= threshold {
                threshold_counts[slot] += 1;
            }
        }
        let Some(token_count) = tokens.get(id.as_str()).copied().flatten() else {
            weighted_numerator = None;
            weighted_denominator = None;
            threshold_totals = [None, None, None];
            continue;
        };
        weighted_numerator = weighted_numerator.and_then(|total| {
            u128::from(token_count)
                .checked_mul(age as u128)
                .and_then(|value| total.checked_add(value))
        });
        weighted_denominator =
            weighted_denominator.and_then(|total| total.checked_add(u128::from(token_count)));
        for (slot, threshold) in [5, 10, 20].into_iter().enumerate() {
            if age >= threshold {
                threshold_totals[slot] = threshold_totals[slot].and_then(|total| {
                    total
                        .checked_add(token_count)
                        .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
                });
            }
        }
    }
    CallAgeMetrics {
        oldest_live_item_age_calls: oldest,
        median_live_item_age_calls: median,
        token_weighted_mean_age_calls: match (weighted_numerator, weighted_denominator) {
            (Some(numerator), Some(denominator)) if denominator > 0 => {
                Some(numerator as f64 / denominator as f64)
            }
            _ => None,
        },
        tokens_at_least_5_calls_old: threshold_totals[0],
        tokens_at_least_10_calls_old: threshold_totals[1],
        tokens_at_least_20_calls_old: threshold_totals[2],
        items_at_least_5_calls_old: threshold_counts[0],
        items_at_least_10_calls_old: threshold_counts[1],
        items_at_least_20_calls_old: threshold_counts[2],
    }
}

fn sum_ids(ids: &[impl AsRef<str>], tokens: &BTreeMap<&str, Option<u64>>) -> Option<u64> {
    ids.iter().try_fold(0_u64, |total, id| {
        total
            .checked_add(tokens.get(id.as_ref()).copied().flatten()?)
            .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
    })
}

fn median_usize(values: &[usize]) -> Option<f64> {
    if values.is_empty() {
        return None;
    }
    let mut sorted = values.to_vec();
    sorted.sort_unstable();
    let middle = sorted.len() / 2;
    if sorted.len().is_multiple_of(2) {
        Some((sorted[middle - 1] as u128 + sorted[middle] as u128) as f64 / 2.0)
    } else {
        Some(sorted[middle] as f64)
    }
}
