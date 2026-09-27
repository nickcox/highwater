pub(crate) mod economics;
pub(crate) mod metrics;
pub(crate) mod reconciliation;
pub(crate) mod tokenization;

use crate::{api::*, domain::*};
use metrics::{calculate_age, calculate_transition, TransitionMetrics};
use reconciliation::{reconciliation_status, reported_prompt_tokens, UsageCompleteness};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    time::Instant,
};
use thiserror::Error;
use tokenization::{
    preview_payload, EstimateIndex, PayloadPreview, ProfileIndex, ProfileRegistry, TokenCoverage,
    TokenEstimate, TokenizationMethod, TokenizationProfile,
};

pub(crate) use tokenization::TokenizationPolicy;

pub(crate) const ANALYSIS_SCHEMA_VERSION: u32 = 7;
// Bump this when serialized analysis output can change without a schema change.
pub(crate) const ANALYSIS_OUTPUT_VERSION: u32 = 9;

#[derive(Debug, Clone, Copy)]
pub(crate) struct AnalysisConfig {
    pub tokenization: TokenizationPolicy,
    pub perf_diagnostics: bool,
}

#[derive(Debug, Error)]
pub(crate) enum AnalysisError {
    #[error("analysis arithmetic overflow")]
    Overflow,
}

#[derive(Debug)]
struct CallWork<'a> {
    call: &'a NormalizedModelCall,
    profile_index: ProfileIndex,
    context_membership: HashSet<&'a str>,
    /// Aligned with `call.context_item_ids`; `None` only represents a malformed
    /// source reference that the adapter left unresolved.
    estimate_indexes: Vec<Option<EstimateIndex>>,
}

#[derive(Debug, Clone, Copy)]
struct ItemTokenTurnsAccumulator {
    token_turns: Option<u64>,
    covered_calls: usize,
    complete_calls: usize,
    partial_calls: usize,
    unavailable_calls: usize,
}

impl Default for ItemTokenTurnsAccumulator {
    fn default() -> Self {
        Self {
            token_turns: Some(0),
            covered_calls: 0,
            complete_calls: 0,
            partial_calls: 0,
            unavailable_calls: 0,
        }
    }
}

struct DerivedTransition {
    added_ids: Vec<String>,
    retained_ids: Vec<String>,
    dropped_ids: Vec<String>,
    item_counts: TransitionItemCounts,
}

struct ApiCallDerived {
    token_analysis: CallTokenAnalysis,
    added_ids: Vec<String>,
    dropped_ids: Vec<String>,
    transition_item_counts: TransitionItemCounts,
    cumulative: UsageSnapshot,
}

#[derive(Debug, Clone, Copy)]
struct UsageSnapshot {
    prompt: Option<u64>,
    completion: Option<u64>,
    reasoning: Option<u64>,
    completeness: UsageCompleteness,
}

fn derive_transition(
    works: &[CallWork<'_>],
    position: usize,
    work: &CallWork<'_>,
) -> DerivedTransition {
    let Some(previous) = position.checked_sub(1).and_then(|index| works.get(index)) else {
        let added_ids = work.call.context_item_ids.clone();
        return DerivedTransition {
            item_counts: TransitionItemCounts {
                added: added_ids.len(),
                retained: 0,
                dropped: 0,
            },
            added_ids,
            retained_ids: Vec::new(),
            dropped_ids: Vec::new(),
        };
    };

    let added_ids = work
        .call
        .context_item_ids
        .iter()
        .filter(|id| !previous.context_membership.contains(id.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    let retained_ids = work
        .call
        .context_item_ids
        .iter()
        .filter(|id| previous.context_membership.contains(id.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    let dropped_ids = previous
        .call
        .context_item_ids
        .iter()
        .filter(|id| !work.context_membership.contains(id.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    let item_counts = TransitionItemCounts {
        added: added_ids.len(),
        retained: retained_ids.len(),
        dropped: dropped_ids.len(),
    };
    DerivedTransition {
        added_ids,
        retained_ids,
        dropped_ids,
        item_counts,
    }
}

pub(crate) fn analyze(
    session: NormalizedSession,
    config: AnalysisConfig,
) -> Result<Analysis, AnalysisError> {
    let analysis_started = Instant::now();
    let mut registry = ProfileRegistry::default();
    let mut works: Vec<CallWork<'_>> = Vec::with_capacity(session.model_calls.len());
    let item_lookup: HashMap<&str, &NormalizedContextItem> = session
        .context_items
        .iter()
        .map(|item| (item.id.as_str(), item))
        .collect();
    // Payloads are immutable for an analysis. Fingerprinting them once here
    // keeps cache hits in the call/presence loop fixed-size operations.
    let fingerprint_started = Instant::now();
    let item_fingerprints: HashMap<&str, _> = session
        .context_items
        .iter()
        .map(|item| (item.id.as_str(), registry.fingerprint_item(item)))
        .collect();
    let fingerprint_ms = fingerprint_started.elapsed().as_secs_f64() * 1000.0;
    let tokenize_started = Instant::now();
    let mut methods = BTreeMap::<String, usize>::new();

    for call in &session.model_calls {
        let (profile_index, profile) =
            registry.profile_with_index(&call.target, config.tokenization);
        let estimate_indexes = call
            .context_item_ids
            .iter()
            .map(|item_id| {
                let (Some(item), Some(fingerprint)) = (
                    item_lookup.get(item_id.as_str()),
                    item_fingerprints.get(item_id.as_str()),
                ) else {
                    return None;
                };
                Some(registry.estimate_index(item, *fingerprint, &profile, &call.target))
            })
            .collect();
        *methods.entry(profile.method.as_str().into()).or_default() += 1;
        let context_membership = call.context_item_ids.iter().map(String::as_str).collect();
        works.push(CallWork {
            call,
            profile_index,
            context_membership,
            estimate_indexes,
        });
    }

    let derived_transitions = works
        .iter()
        .enumerate()
        .map(|(position, work)| derive_transition(&works, position, work))
        .collect::<Vec<_>>();

    // All destination-profile estimates are planned before metric calculation.
    // The registry is read-only after this point.
    let mut destination_estimates: Vec<HashMap<&str, EstimateIndex>> =
        (0..works.len()).map(|_| HashMap::new()).collect();
    for position in 1..works.len() {
        let work = &works[position];
        for item_id in &derived_transitions[position].dropped_ids {
            let (Some((stored_id, item)), Some(fingerprint)) = (
                item_lookup.get_key_value(item_id.as_str()),
                item_fingerprints.get(item_id.as_str()),
            ) else {
                continue;
            };
            let estimate_index = registry.estimate_index_at_profile(
                item,
                *fingerprint,
                work.profile_index,
                &work.call.target,
            );
            destination_estimates[position].insert(*stored_id, estimate_index);
        }
    }

    let all_profiles = registry.profiles().cloned().collect::<Vec<_>>();
    let mut item_estimates: HashMap<String, BTreeMap<String, TokenEstimate>> = HashMap::new();
    for work in &works {
        for (item_id, estimate_index) in work
            .call
            .context_item_ids
            .iter()
            .zip(&work.estimate_indexes)
        {
            let Some(estimate_index) = estimate_index else {
                continue;
            };
            let estimate = registry.estimate_at(*estimate_index);
            item_estimates
                .entry(item_id.clone())
                .or_default()
                .insert(estimate.profile_id.clone(), estimate.clone());
        }
    }
    for estimates in &destination_estimates {
        for (item_id, estimate_index) in estimates {
            let estimate = registry.estimate_at(*estimate_index);
            item_estimates
                .entry((*item_id).to_owned())
                .or_default()
                .insert(estimate.profile_id.clone(), estimate.clone());
        }
    }

    let tokenize_ms = tokenize_started.elapsed().as_secs_f64() * 1000.0;
    let (cumulative_usages, usage_totals) = usage_rollup(&session.model_calls);
    let (call_economics, economics_summary) =
        economics::derive_with_cost_basis(&session.model_calls, session.source.cost_basis);
    let metrics_started = Instant::now();
    let mut model_calls = Vec::with_capacity(works.len());
    let mut residual_percents = Vec::new();
    let mut complete_reconciliation = 0;
    let mut comparable_reconciliation = 0;
    let mut negative_residuals = 0;
    let mut missing_provider_usage = 0;
    let mut peak_calculated_visible = None;

    for (position, (work, derived_transition)) in works.iter().zip(derived_transitions).enumerate()
    {
        let profile = registry.profile_at(work.profile_index);
        let estimates = work
            .estimate_indexes
            .iter()
            .filter_map(|estimate_index| estimate_index.map(|index| registry.estimate_at(index)))
            .collect::<Vec<_>>();
        let current_tokens = work
            .call
            .context_item_ids
            .iter()
            .zip(&work.estimate_indexes)
            .filter_map(|(id, estimate_index)| {
                Some((id.clone(), registry.estimate_at((*estimate_index)?).tokens))
            })
            .collect::<BTreeMap<_, _>>();
        let metric_tokens = work
            .call
            .context_item_ids
            .iter()
            .zip(&work.estimate_indexes)
            .filter_map(|(id, estimate_index)| {
                let estimate = registry.estimate_at((*estimate_index)?);
                Some((
                    id.clone(),
                    (estimate.coverage == TokenCoverage::Complete)
                        .then_some(estimate.tokens)
                        .flatten(),
                ))
            })
            .collect::<BTreeMap<_, _>>();
        let coverage = estimate_coverage(estimates.iter().copied());
        let visible_tokens = sum_map_values(&current_tokens);
        peak_calculated_visible = max_option(peak_calculated_visible, visible_tokens);
        let known_framing = profile.framing_overhead(work.call.context_item_ids.len());
        let calculated_request = visible_tokens
            .and_then(|visible| known_framing.and_then(|framing| visible.checked_add(framing)));
        let (reported_prompt, usage_completeness) =
            reported_prompt_tokens(&work.call.reported_usage);
        if usage_completeness == UsageCompleteness::Missing {
            missing_provider_usage += 1;
        }
        let residual = match (reported_prompt, calculated_request) {
            (Some(reported), Some(calculated)) => {
                match (i64::try_from(reported), i64::try_from(calculated)) {
                    (Ok(reported), Ok(calculated)) => reported.checked_sub(calculated),
                    _ => None,
                }
            }
            _ => None,
        };
        let residual_percent = residual.and_then(|value| {
            if reported_prompt == Some(0) {
                None
            } else {
                Some((value.unsigned_abs() as f64) / reported_prompt.unwrap_or(1) as f64)
            }
        });
        if let Some(value) = residual_percent {
            comparable_reconciliation += 1;
            residual_percents.push(value);
        }
        if residual.is_some_and(|value| value < 0) {
            negative_residuals += 1;
        }
        let mut explanation_codes = Vec::new();
        if usage_completeness != UsageCompleteness::Complete {
            explanation_codes.push("providerUsageIncomplete".into());
        }
        if profile.method == TokenizationMethod::Unavailable {
            explanation_codes.push("unsupportedTokenizer".into());
        }
        if profile.method == TokenizationMethod::CharacterHeuristic {
            explanation_codes.push("heuristicTokenizer".into());
        }
        if profile.method == TokenizationMethod::ApiSerializationEstimate {
            explanation_codes.push("estimatedProviderSerialization".into());
        }
        if estimates.iter().any(|estimate| {
            estimate
                .note_codes
                .iter()
                .any(|code| code == "unsupportedImage")
        }) {
            explanation_codes.push("unsupportedImage".into());
        }
        if estimates.iter().any(|estimate| {
            estimate
                .note_codes
                .iter()
                .any(|code| code == "unavailablePayload" || code == "unsupportedPayload")
        }) {
            explanation_codes.push("unsupportedPayload".into());
        }
        if known_framing.is_some() {
            explanation_codes.push("knownFramingOverheadAvailable".into());
        }
        if !work.call.context_item_ids.iter().any(|id| {
            item_lookup
                .get(id.as_str())
                .is_some_and(|item| item.kind == ContextItemKind::System)
        }) {
            explanation_codes.push("missingSystemPrompt".into());
        }
        if !work.call.context_item_ids.iter().any(|id| {
            item_lookup
                .get(id.as_str())
                .is_some_and(|item| item.kind == ContextItemKind::ToolDefinition)
        }) {
            explanation_codes.push("missingToolDefinitions".into());
        }
        if estimates.iter().any(|estimate| {
            estimate
                .note_codes
                .iter()
                .any(|code| code == "modelSwitchTransformation")
        }) {
            explanation_codes.push("modelSwitchTransformation".into());
        }
        if residual.is_some_and(|value| value < 0) {
            explanation_codes.push("negativeResidual".into());
        }
        explanation_codes.sort();
        explanation_codes.dedup();

        let transition = if position == 0 {
            let added = sum_ids(&work.call.context_item_ids, &metric_tokens);
            let current_total = sum_ids(&work.call.context_item_ids, &metric_tokens);
            TransitionMetrics {
                added,
                retained: Some(0),
                dropped: Some(0),
                churn: None,
                reuse: None,
                addition_share: match (added, current_total) {
                    (Some(added), Some(total)) if total > 0 => Some(added as f64 / total as f64),
                    _ => None,
                },
                removal_share: None,
            }
        } else {
            let previous = &works[position - 1].call.context_item_ids;
            let mut destination_tokens = metric_tokens.clone();
            for id in previous {
                if !destination_tokens.contains_key(id) {
                    if let Some(estimate_index) = destination_estimates[position].get(id.as_str()) {
                        let estimate = registry.estimate_at(*estimate_index);
                        destination_tokens.insert(
                            id.clone(),
                            (estimate.coverage == TokenCoverage::Complete)
                                .then_some(estimate.tokens)
                                .flatten(),
                        );
                    }
                }
            }
            calculate_transition(
                &derived_transition.added_ids,
                &derived_transition.retained_ids,
                &derived_transition.dropped_ids,
                previous,
                &work.call.context_item_ids,
                &destination_tokens,
            )
        };
        let age = calculate_age(
            &work.call.context_item_ids,
            &item_lookup,
            &metric_tokens,
            work.call.index,
        );
        let status = reconciliation_status(
            reported_prompt,
            calculated_request,
            residual_percent,
            &coverage,
            usage_completeness,
        );
        if reported_prompt.is_some()
            && calculated_request.is_some()
            && usage_completeness == UsageCompleteness::Complete
            && coverage.partial_items == 0
            && coverage.unavailable_items == 0
        {
            complete_reconciliation += 1;
        }
        let token_analysis = CallTokenAnalysis {
            reported_prompt_tokens: reported_prompt,
            reported_completion_tokens: work.call.reported_usage.output,
            reported_total_tokens: work.call.reported_usage.total_tokens,
            reported_usage_completeness: usage_completeness.as_str().into(),
            calculated_visible_tokens: visible_tokens,
            known_framing_overhead_tokens: known_framing,
            calculated_request_tokens: calculated_request,
            residual_tokens: residual,
            residual_percent,
            status,
            explanation_codes,
            estimate_coverage: coverage,
            added_tokens: transition.added,
            retained_tokens: transition.retained,
            dropped_tokens: transition.dropped,
            churn: transition.churn,
            reuse: transition.reuse,
            addition_share: transition.addition_share,
            removal_share: transition.removal_share,
            age,
        };
        model_calls.push(to_api_call(
            work,
            profile,
            call_economics[position].clone(),
            ApiCallDerived {
                token_analysis,
                added_ids: derived_transition.added_ids,
                dropped_ids: derived_transition.dropped_ids,
                transition_item_counts: derived_transition.item_counts,
                cumulative: cumulative_usages[position],
            },
        ));
    }

    let final_model_call = session.model_calls.last().map(|call| call.index);
    let mut context_items = Vec::with_capacity(session.context_items.len());
    let mut total_token_turns = 0_u64;
    let mut total_turns_complete = true;
    let mut item_coverage = CoverageSummary::default();
    let mut item_turns_by_id: HashMap<&str, ItemTokenTurnsAccumulator> = HashMap::new();
    for work in &works {
        for (item_id, estimate_index) in work
            .call
            .context_item_ids
            .iter()
            .zip(&work.estimate_indexes)
        {
            let accumulator = item_turns_by_id.entry(item_id.as_str()).or_default();
            let Some(estimate_index) = estimate_index else {
                accumulator.unavailable_calls += 1;
                continue;
            };
            let estimate = registry.estimate_at(*estimate_index);
            if let Some(tokens) = estimate.tokens {
                accumulator.token_turns = accumulator
                    .token_turns
                    .and_then(|total| total.checked_add(tokens));
                accumulator.covered_calls += 1;
                match estimate.coverage {
                    TokenCoverage::Complete => accumulator.complete_calls += 1,
                    TokenCoverage::Partial => accumulator.partial_calls += 1,
                    TokenCoverage::Unavailable => accumulator.unavailable_calls += 1,
                }
            } else {
                accumulator.unavailable_calls += 1;
            }
        }
    }
    for item in &session.context_items {
        let accumulator = item_turns_by_id
            .get(item.id.as_str())
            .copied()
            .unwrap_or_default();
        let item_turns = accumulator.token_turns.ok_or(AnalysisError::Overflow)?;
        let covered_calls = accumulator.covered_calls;
        let complete_calls = accumulator.complete_calls;
        let partial_calls = accumulator.partial_calls;
        let unavailable_calls = accumulator.unavailable_calls;
        let total_calls = item
            .presence
            .iter()
            .map(PresenceRange::call_count)
            .sum::<usize>();
        let complete = total_calls > 0
            && unavailable_calls == 0
            && partial_calls == 0
            && complete_calls == total_calls;
        if complete {
            total_token_turns = total_token_turns
                .checked_add(item_turns)
                .ok_or(AnalysisError::Overflow)?;
        } else {
            total_turns_complete = false;
            if covered_calls > 0 {
                total_token_turns = total_token_turns
                    .checked_add(item_turns)
                    .ok_or(AnalysisError::Overflow)?;
            }
        }
        match (complete_calls > 0, partial_calls > 0, unavailable_calls > 0) {
            (true, false, false) => item_coverage.complete_items += 1,
            (_, true, _) => item_coverage.partial_items += 1,
            (_, _, true) => item_coverage.unavailable_items += 1,
            _ => item_coverage.unavailable_items += 1,
        }
        item_coverage.total_items += 1;
        item_coverage.covered_calls += covered_calls;
        item_coverage.total_calls += total_calls;
        let estimate_dtos = item_estimates
            .get(&item.id)
            .map(|estimates| estimates.values().map(to_api_estimate).collect())
            .unwrap_or_default();
        let coverage = CoverageSummary {
            complete_items: usize::from(complete),
            partial_items: usize::from(!complete && covered_calls > 0),
            unavailable_items: usize::from(unavailable_calls > 0),
            total_items: 1,
            covered_calls,
            total_calls,
        };
        context_items.push(ContextItem {
            id: item.id.clone(),
            kind: item.kind.as_str().into(),
            label: item.label.clone(),
            preview: Some(to_api_preview(&preview_payload(&item.payload))),
            source_record_id: item.source_record_id.clone(),
            source_tool_call_id: item.source_tool_call_id.clone(),
            first_model_call: item.first_model_call,
            last_model_call: item.last_model_call,
            age_at_final_model_call: final_model_call
                .filter(|_| item.first_model_call > 0)
                .and_then(|final_call| final_call.checked_sub(item.first_model_call)),
            display_weight: item.serialized_size as f64,
            presence: item
                .presence
                .iter()
                .map(|range| Range {
                    start_call: range.start_call,
                    end_call: range.end_call,
                })
                .collect(),
            presence_call_count: total_calls,
            metadata: item.metadata.clone(),
            token_estimates: estimate_dtos,
            token_turns: (covered_calls > 0).then_some(item_turns),
            token_turns_coverage: coverage,
        });
    }
    let metrics_ms = metrics_started.elapsed().as_secs_f64() * 1000.0;
    let total_turn_coverage = CoverageSummary {
        complete_items: item_coverage.complete_items,
        partial_items: item_coverage.partial_items,
        unavailable_items: item_coverage.unavailable_items,
        total_items: item_coverage.total_items,
        covered_calls: context_items
            .iter()
            .map(|item| item.token_turns_coverage.covered_calls)
            .sum(),
        total_calls: context_items
            .iter()
            .map(|item| item.token_turns_coverage.total_calls)
            .sum(),
    };
    let has_tokenizable_items = works
        .iter()
        .any(|work| work.estimate_indexes.iter().any(Option::is_some));
    let all_numeric_token_weights = config.tokenization != TokenizationPolicy::Off
        && has_tokenizable_items
        && works.iter().all(|work| {
            work.estimate_indexes.iter().all(|estimate_index| {
                estimate_index
                    .map(|index| registry.estimate_at(index).tokens.is_some())
                    .unwrap_or(false)
            })
        });
    let chart_is_calculated_tokens = all_numeric_token_weights
        && works.iter().all(|work| {
            work.estimate_indexes.iter().all(|estimate_index| {
                estimate_index
                    .map(|index| {
                        let estimate = registry.estimate_at(index);
                        estimate.coverage == TokenCoverage::Complete
                            && estimate.method == TokenizationMethod::ModelTokenizer
                    })
                    .unwrap_or(false)
            })
        });
    let has_partial_token_coverage = works.iter().any(|work| {
        work.estimate_indexes.iter().any(|estimate_index| {
            estimate_index
                .map(|index| registry.estimate_at(index).coverage == TokenCoverage::Partial)
                .unwrap_or(false)
        })
    });
    let has_best_effort_tokenization = works.iter().any(|work| {
        work.estimate_indexes.iter().any(|estimate_index| {
            estimate_index
                .map(|index| {
                    registry.estimate_at(index).method != TokenizationMethod::ModelTokenizer
                })
                .unwrap_or(false)
        })
    });
    let chart_is_estimated_tokens = all_numeric_token_weights && !chart_is_calculated_tokens;
    let chart_unit = if chart_is_calculated_tokens {
        "calculatedTokens"
    } else if chart_is_estimated_tokens {
        "estimatedTokens"
    } else {
        "unavailable"
    };
    let fallback_reason = if chart_is_calculated_tokens {
        None
    } else if chart_is_estimated_tokens {
        Some(
            if has_partial_token_coverage {
                "partial-token-coverage"
            } else if has_best_effort_tokenization {
                "best-effort-tokenization"
            } else {
                "estimated-token-geometry"
            }
            .into(),
        )
    } else if config.tokenization == TokenizationPolicy::Off {
        Some("tokenizationDisabled".into())
    } else {
        Some("one-or-more-context-items-unavailable".into())
    };
    let median = median(&residual_percents);
    let maximum = residual_percents.iter().copied().max_by(f64::total_cmp);
    let profiles = all_profiles
        .iter()
        .map(|profile| TokenizationProfileSummary {
            id: profile.id.clone(),
            provider: profile.provider.clone(),
            model: profile.model.clone(),
            api: profile.api.clone(),
            tokenizer_family: profile.family.as_str().into(),
            method: profile.method.as_str().into(),
            version: profile.version,
            rule: profile.rule.clone(),
        })
        .collect::<Vec<_>>();
    let reported_prompt = usage_totals.prompt;
    let reported_completeness = usage_totals.completeness;
    let analysis_summary = TokenAnalysisSummary {
        policy: config.tokenization.as_str().into(),
        chart_unit: chart_unit.into(),
        fallback_reason: fallback_reason.clone(),
        profiles,
        item_estimate_coverage: item_coverage.clone(),
        calls_with_complete_reconciliation: complete_reconciliation,
        calls_with_comparable_reconciliation: comparable_reconciliation,
        tokenizer_methods: methods,
        median_absolute_residual_percent: median,
        maximum_absolute_residual_percent: maximum,
        negative_residual_calls: negative_residuals,
        calls_missing_provider_usage: missing_provider_usage,
        total_calculated_token_turns: (total_token_turns > 0 || total_turns_complete)
            .then_some(total_token_turns),
        total_token_turns_coverage: total_turn_coverage.clone(),
    };
    if config.perf_diagnostics {
        let stats = registry.stats();
        let presence_count = session
            .context_items
            .iter()
            .map(|item| {
                item.presence
                    .iter()
                    .map(PresenceRange::call_count)
                    .sum::<usize>()
            })
            .sum::<usize>();
        eprintln!(
            "analysis_perf analysis_ms={:.3} fingerprint_ms={:.3} tokenize_ms={:.3} metrics_ms={:.3} calls={} items={} presences={} unique_profiles={} unique_payloads={} estimates_calculated={} estimate_hits={} tokenizer_invocations={} fingerprint_operations={}",
            analysis_started.elapsed().as_secs_f64() * 1000.0,
            fingerprint_ms,
            tokenize_ms,
            metrics_ms,
            session.model_calls.len(),
            session.context_items.len(),
            presence_count,
            all_profiles.len(),
            stats.unique_payloads,
            stats.unique_estimates,
            stats.estimate_cache_hits,
            stats.tokenizer_invocations,
            stats.payloads_fingerprinted,
        );
    }
    Ok(Analysis {
        schema_version: ANALYSIS_SCHEMA_VERSION,
        token_analysis: analysis_summary,
        economics: economics_summary,
        session: SessionSummary {
            id: session.id,
            source: session.source.kind,
            title: session.title,
            working_directory: session.working_directory,
            reported_prompt_tokens: reported_prompt,
            reported_completion_tokens: usage_totals.completion,
            reported_reasoning_tokens: usage_totals.reasoning,
            reported_cost_total: usage_cost_total(&session.model_calls),
            reported_usage_completeness: reported_completeness.as_str().into(),
            calculated_token_turns: (total_token_turns > 0 || total_turns_complete)
                .then_some(total_token_turns),
            calculated_token_turns_coverage: total_turn_coverage,
            peak_calculated_visible_tokens: peak_calculated_visible,
            reconciliation_complete_calls: complete_reconciliation,
            reconciliation_comparable_calls: comparable_reconciliation,
            median_absolute_residual_percent: median,
            maximum_absolute_residual_percent: maximum,
            negative_residual_calls: negative_residuals,
            missing_provider_usage_calls: missing_provider_usage,
        },
        display_weight_unit: chart_unit.into(),
        model_calls,
        context_items,
        compactions: session
            .compactions
            .into_iter()
            .map(|event| Compaction {
                id: event.id,
                before_model_call: event.before_model_call,
                source_item_ids: event.source_item_ids,
                retained_item_ids: event.retained_item_ids,
                summary_item_id: event.summary_item_id,
                tokens_before: event.tokens_before,
            })
            .collect(),
        lineage: session
            .lineage
            .into_iter()
            .map(|edge| Lineage {
                from: edge.from,
                to: edge.to,
                kind: edge.kind,
            })
            .collect(),
    })
}

fn to_api_call(
    work: &CallWork<'_>,
    profile: &TokenizationProfile,
    economics: CallEconomics,
    derived: ApiCallDerived,
) -> ModelCall {
    let usage = &work.call.reported_usage;
    ModelCall {
        index: work.call.index,
        source_record_id: work.call.source_record_id.clone(),
        provider: work.call.target.provider.clone(),
        model: work.call.target.model.clone(),
        api: work.call.target.api.clone(),
        usage: Usage {
            input: usage.input,
            output: usage.output,
            cache_read: usage.cache_read,
            cache_write: usage.cache_write,
            cache_write_1h: usage.cache_write_1h,
            reasoning: usage.reasoning,
            total_tokens: usage.total_tokens,
        },
        reported_prompt_tokens: derived.token_analysis.reported_prompt_tokens,
        reported_completion_tokens: derived.token_analysis.reported_completion_tokens,
        reported_total_tokens: derived.token_analysis.reported_total_tokens,
        reported_usage_completeness: derived.token_analysis.reported_usage_completeness.clone(),
        cumulative_reported_prompt_tokens: derived.cumulative.prompt,
        cumulative_reported_completion_tokens: derived.cumulative.completion,
        cumulative_reported_reasoning_tokens: derived.cumulative.reasoning,
        cumulative_reported_usage_completeness: derived.cumulative.completeness.as_str().into(),
        cost: cost_dto(usage),
        stop_reason: work.call.stop_reason.clone(),
        context_item_ids: work.call.context_item_ids.clone(),
        added_item_ids: derived.added_ids,
        dropped_item_ids: derived.dropped_ids,
        transition_item_counts: derived.transition_item_counts,
        tool_calls_after: work
            .call
            .tool_calls_after
            .iter()
            .map(|tool| ToolCall {
                id: tool.id.clone(),
                name: tool.name.clone(),
                failed: tool.failed,
            })
            .collect(),
        compaction_before: work.call.compaction_before.clone(),
        tokenization_profile_id: Some(profile.id.clone()),
        token_analysis: derived.token_analysis,
        economics,
    }
}

fn cost_dto(usage: &ReportedUsage) -> Option<Cost> {
    let cost = &usage.cost;
    (cost.input.is_some()
        || cost.output.is_some()
        || cost.cache_read.is_some()
        || cost.cache_write.is_some()
        || cost.total.is_some())
    .then_some(Cost {
        input: cost.input,
        output: cost.output,
        cache_read: cost.cache_read,
        cache_write: cost.cache_write,
        total: cost.total,
    })
}

fn to_api_preview(preview: &PayloadPreview) -> ContextItemPreview {
    ContextItemPreview {
        text: preview.text.clone(),
        kind: preview.kind.into(),
        truncated: preview.truncated,
        expanded_text: preview.expanded_text.clone(),
        expanded_truncated: preview.expanded_truncated,
    }
}

fn to_api_estimate(estimate: &TokenEstimate) -> ContextItemTokenEstimate {
    ContextItemTokenEstimate {
        profile_id: estimate.profile_id.clone(),
        tokens: estimate.tokens,
        method: estimate.method.as_str().into(),
        coverage: estimate.coverage.as_str().into(),
        note_codes: estimate.note_codes.clone(),
    }
}

fn estimate_coverage<'a>(estimates: impl Iterator<Item = &'a TokenEstimate>) -> CoverageSummary {
    let mut coverage = CoverageSummary::default();
    for estimate in estimates {
        coverage.total_items += 1;
        coverage.total_calls += 1;
        if estimate.tokens.is_some() {
            coverage.covered_calls += 1;
        }
        match estimate.coverage {
            TokenCoverage::Complete => coverage.complete_items += 1,
            TokenCoverage::Partial => coverage.partial_items += 1,
            TokenCoverage::Unavailable => coverage.unavailable_items += 1,
        }
    }
    coverage
}

fn sum_map_values(values: &BTreeMap<String, Option<u64>>) -> Option<u64> {
    values
        .values()
        .try_fold(0_u64, |total, value| total.checked_add((*value)?))
}

fn sum_ids(ids: &[String], values: &BTreeMap<String, Option<u64>>) -> Option<u64> {
    ids.iter().try_fold(0_u64, |total, id| {
        total.checked_add(values.get(id).copied().flatten()?)
    })
}
fn max_option(left: Option<u64>, right: Option<u64>) -> Option<u64> {
    match (left, right) {
        (Some(left), Some(right)) => Some(left.max(right)),
        (Some(left), None) => Some(left),
        (None, Some(right)) => Some(right),
        (None, None) => None,
    }
}
fn median(values: &[f64]) -> Option<f64> {
    if values.is_empty() {
        return None;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(f64::total_cmp);
    let middle = sorted.len() / 2;
    if sorted.len().is_multiple_of(2) {
        Some((sorted[middle - 1] + sorted[middle]) / 2.0)
    } else {
        Some(sorted[middle])
    }
}

#[derive(Debug, Clone, Copy)]
struct CumulativeUsage {
    prompt_sum: u64,
    prompt_overflow: bool,
    prompt_complete: bool,
    prompt_known: bool,
    output_sum: u64,
    output_complete: bool,
    reasoning_sum: u64,
    reasoning_complete: bool,
}

impl Default for CumulativeUsage {
    fn default() -> Self {
        Self {
            prompt_sum: 0,
            prompt_overflow: false,
            prompt_complete: true,
            prompt_known: false,
            output_sum: 0,
            output_complete: true,
            reasoning_sum: 0,
            reasoning_complete: true,
        }
    }
}

impl CumulativeUsage {
    fn update(&mut self, call: &NormalizedModelCall) {
        let (prompt, completeness) = reported_prompt_tokens(&call.reported_usage);
        match completeness {
            UsageCompleteness::Complete => {
                self.prompt_known = true;
                if let Some(value) = prompt {
                    if let Some(total) = self.prompt_sum.checked_add(value) {
                        self.prompt_sum = total;
                    } else {
                        self.prompt_overflow = true;
                    }
                } else {
                    self.prompt_overflow = true;
                }
            }
            UsageCompleteness::Partial => {
                self.prompt_complete = false;
                self.prompt_known = true;
            }
            UsageCompleteness::Missing => self.prompt_complete = false,
        }
        if let Some(value) = call.reported_usage.output {
            if let Some(total) = self.output_sum.checked_add(value) {
                self.output_sum = total;
            } else {
                self.output_complete = false;
            }
        } else {
            self.output_complete = false;
        }
        if let Some(value) = call.reported_usage.reasoning {
            if let Some(total) = self.reasoning_sum.checked_add(value) {
                self.reasoning_sum = total;
            } else {
                self.reasoning_complete = false;
            }
        } else {
            self.reasoning_complete = false;
        }
    }

    fn finish(self) -> UsageSnapshot {
        let prompt_complete = self.prompt_complete && !self.prompt_overflow && self.prompt_known;
        let completeness = if prompt_complete {
            UsageCompleteness::Complete
        } else if self.prompt_known {
            UsageCompleteness::Partial
        } else {
            UsageCompleteness::Missing
        };
        UsageSnapshot {
            prompt: prompt_complete.then_some(self.prompt_sum),
            completion: self.output_complete.then_some(self.output_sum),
            reasoning: self.reasoning_complete.then_some(self.reasoning_sum),
            completeness,
        }
    }
}

fn usage_rollup(calls: &[NormalizedModelCall]) -> (Vec<UsageSnapshot>, UsageSnapshot) {
    let mut accumulator = CumulativeUsage::default();
    let snapshots = calls
        .iter()
        .map(|call| {
            accumulator.update(call);
            accumulator.finish()
        })
        .collect();
    let final_snapshot = if calls.is_empty() {
        UsageSnapshot {
            prompt: None,
            completion: None,
            reasoning: None,
            completeness: UsageCompleteness::Missing,
        }
    } else {
        accumulator.finish()
    };
    (snapshots, final_snapshot)
}
fn usage_cost_total(calls: &[NormalizedModelCall]) -> Option<f64> {
    if calls.is_empty() {
        return None;
    }
    calls.iter().try_fold(0.0_f64, |total, call| {
        let value = call
            .reported_usage
            .cost
            .total
            .filter(|value| value.is_finite() && *value >= 0.0)?;
        let next = total + value;
        next.is_finite().then_some(next)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{SessionSourceAdapter, SourceError};

    fn fake_session() -> NormalizedSession {
        let item = NormalizedContextItem {
            id: "opaque-item".into(),
            kind: ContextItemKind::UserMessage,
            label: "user".into(),
            source_record_id: Some("record".into()),
            source_tool_call_id: None,
            metadata: BTreeMap::new(),
            serialized_size: 20,
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

    struct FakeSourceAdapter;

    impl SessionSourceAdapter for FakeSourceAdapter {
        fn source_descriptor(&self) -> SourceDescriptor {
            SourceDescriptor {
                kind: "fake".into(),
                version: "test-v1".into(),
                cost_basis: CostBasis::Unknown,
            }
        }

        fn parse(
            &self,
            _input: &mut dyn std::io::BufRead,
        ) -> Result<NormalizedSession, SourceError> {
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
            },
        )
        .expect("analysis");
        assert_eq!(analysis.session.source, "fake");
        assert_eq!(analysis.context_items[0].id, "opaque-item");
    }

    #[test]
    fn analysis_accepts_source_neutral_opaque_ids() {
        let analysis = analyze(
            fake_session(),
            AnalysisConfig {
                tokenization: TokenizationPolicy::Heuristic,
                perf_diagnostics: false,
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
            serialized_size: 4,
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
            index,
            source_record_id: format!("call-{index}"),
            target: ModelTarget {
                provider: Some("unknown".into()),
                model: Some("unknown".into()),
                api: None,
            },
            reported_usage: ReportedUsage::default(),
            stop_reason: None,
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
            },
        )
        .expect("analysis");

        let first = &analysis.model_calls[0];
        assert_eq!(first.added_item_ids, ["a", "b", "c"]);
        assert!(first.dropped_item_ids.is_empty());
        assert_eq!(first.transition_item_counts.added, 3);
        assert_eq!(first.transition_item_counts.retained, 0);
        assert_eq!(first.token_analysis.retained_tokens, Some(0));
        assert_eq!(first.token_analysis.dropped_tokens, Some(0));
        assert_eq!(first.token_analysis.churn, None);

        let changed = &analysis.model_calls[1];
        assert_eq!(changed.added_item_ids, ["d"]);
        assert_eq!(changed.dropped_item_ids, ["a"]);
        assert_eq!(changed.transition_item_counts.added, 1);
        assert_eq!(changed.transition_item_counts.retained, 2);
        assert_eq!(changed.transition_item_counts.dropped, 1);
        assert!(changed.token_analysis.added_tokens.is_some());
        assert!(changed.token_analysis.retained_tokens.is_some());
        assert!(changed.token_analysis.dropped_tokens.is_some());

        let unchanged = &analysis.model_calls[2];
        assert!(unchanged.added_item_ids.is_empty());
        assert!(unchanged.dropped_item_ids.is_empty());
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
    fn empty_sessions_have_missing_usage_totals() {
        let mut session = fake_session();
        session.model_calls.clear();
        let analysis = analyze(
            session,
            AnalysisConfig {
                tokenization: TokenizationPolicy::Heuristic,
                perf_diagnostics: false,
            },
        )
        .expect("analysis");
        assert_eq!(analysis.session.reported_prompt_tokens, None);
        assert_eq!(analysis.session.reported_completion_tokens, None);
        assert_eq!(analysis.session.reported_reasoning_tokens, None);
        assert_eq!(analysis.session.reported_usage_completeness, "missing");
    }

    #[test]
    fn analysis_preserves_unsupported_content_coverage() {
        let mut session = fake_session();
        session.context_items[0].payload = TokenizationPayload::UserMessage(MessageContent {
            parts: vec![ContentPart::Text("known".into()), ContentPart::Unsupported],
        });
        let analysis = analyze(
            session,
            AnalysisConfig {
                tokenization: TokenizationPolicy::Heuristic,
                perf_diagnostics: false,
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
    fn session_pi_cost_total_rejects_negative_or_non_finite_values() {
        let mut session = fake_session();
        session.model_calls[0].reported_usage.cost.total = Some(-0.01);
        assert_eq!(usage_cost_total(&session.model_calls), None);

        session.model_calls[0].reported_usage.cost.total = Some(f64::INFINITY);
        assert_eq!(usage_cost_total(&session.model_calls), None);
    }

    #[test]
    fn api_omits_full_normalized_payload_records() {
        let analysis = analyze(
            fake_session(),
            AnalysisConfig {
                tokenization: TokenizationPolicy::Heuristic,
                perf_diagnostics: false,
            },
        )
        .expect("analysis");
        let json = serde_json::to_value(&analysis).expect("json");
        assert_eq!(json["schemaVersion"], 7);
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
            },
        )
        .expect("analysis without diagnostics");
        let with_diagnostics = analyze(
            fake_session(),
            AnalysisConfig {
                tokenization: TokenizationPolicy::Heuristic,
                perf_diagnostics: true,
            },
        )
        .expect("analysis with diagnostics");

        assert_eq!(
            serde_json::to_vec(&without_diagnostics).expect("analysis JSON"),
            serde_json::to_vec(&with_diagnostics).expect("analysis JSON")
        );
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
            },
        )
        .expect("analysis");
        assert_eq!(
            analysis.model_calls[0].token_analysis.residual_percent,
            None
        );
    }
}
