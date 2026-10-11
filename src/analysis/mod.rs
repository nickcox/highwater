#[cfg(test)]
mod contract;
mod diagnostics;
mod economics;
mod metrics;
#[cfg(test)]
mod metrics_tests;
#[cfg(test)]
mod parity;
mod preparation;
mod reconciliation;
#[cfg(test)]
mod test_support;
#[cfg(test)]
mod tests;
mod timing;
mod tokenization;
mod usage;
mod validate;

use crate::{api::*, domain::*, pricing};
use diagnostics::{diagnostic_strings, ChartFallbackReason, ChartUnit, DiagnosticCode};
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
use usage::{session_usage_subtotals, usage_rollup, UsageSnapshot};
use validate::{validate_normalized_session, ValidatedSession};

pub(crate) use tokenization::TokenizationPolicy;

pub(crate) const ANALYSIS_SCHEMA_VERSION: u32 = 13;
// Bump this when serialized analysis output can change without a schema change.
pub(crate) const ANALYSIS_OUTPUT_VERSION: u32 = 24;

#[derive(Debug, Clone, Copy)]
pub(crate) struct AnalysisConfig {
    pub tokenization: TokenizationPolicy,
    pub perf_diagnostics: bool,
}

#[derive(Debug, Error)]
pub(crate) enum AnalysisError {
    #[error("normalized session invariant failed: {0}")]
    InvalidSession(String),
}

#[derive(Debug)]
struct CallWork<'a> {
    call: &'a NormalizedModelCall,
    profile_index: ProfileIndex,
    context_membership: HashSet<&'a str>,
    /// Aligned with validated `call.context_item_ids`. Content uncertainty
    /// remains in the estimate, never in structural reference resolution.
    estimate_indexes: Vec<EstimateIndex>,
}

#[derive(Debug, Clone, Copy, Default)]
struct ItemTokenTurnsAccumulator {
    token_turns: Option<u64>,
    range_failed: bool,
    covered_calls: usize,
    complete_calls: usize,
    partial_calls: usize,
    unavailable_calls: usize,
}

struct DerivedTransition<'a> {
    added_ids: Vec<&'a str>,
    retained_ids: Vec<&'a str>,
    dropped_ids: Vec<&'a str>,
    item_counts: TransitionItemCounts,
}

struct ApiCallDerived {
    token_analysis: CallTokenAnalysis,
    context_indexes: Vec<usize>,
    added_indexes: Vec<usize>,
    dropped_indexes: Vec<usize>,
    transition_item_counts: TransitionItemCounts,
    cumulative: UsageSnapshot,
    cost_assessment: CostAssessment,
}

fn derive_transition<'a>(
    works: &[CallWork<'a>],
    position: usize,
    work: &CallWork<'a>,
) -> DerivedTransition<'a> {
    let Some(previous) = position.checked_sub(1).and_then(|index| works.get(index)) else {
        let added_ids = work
            .call
            .context_item_ids
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>();
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
        .map(String::as_str)
        .collect::<Vec<_>>();
    let retained_ids = work
        .call
        .context_item_ids
        .iter()
        .filter(|id| previous.context_membership.contains(id.as_str()))
        .map(String::as_str)
        .collect::<Vec<_>>();
    let dropped_ids = previous
        .call
        .context_item_ids
        .iter()
        .filter(|id| !work.context_membership.contains(id.as_str()))
        .map(String::as_str)
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
    let validated = validate_normalized_session(&session)?;
    let analysis_started = Instant::now();
    let prepared = preparation::prepare(&session, &validated, config);
    let metrics_started = Instant::now();
    let calls = derive_calls(&session, &prepared);
    let items = derive_items(&session, &prepared);
    let metrics_ms = metrics_started.elapsed().as_secs_f64() * 1000.0;
    debug_assert_eq!(
        validated.compaction_indices.len(),
        session.compactions.len()
    );
    Ok(assemble_analysis(
        &session,
        config,
        &prepared,
        calls,
        items,
        analysis_started,
        metrics_ms,
    ))
}

struct DerivedCalls {
    model_calls: Vec<ModelCall>,
    residual_percents: Vec<f64>,
    complete_reconciliation: usize,
    comparable_reconciliation: usize,
    negative_residuals: usize,
    missing_provider_usage: usize,
    peak_calculated_visible: Option<u64>,
    usage_totals: UsageSnapshot,
    economics_summary: EconomicsSummary,
    cost_summary: CostSummary,
}

fn derive_calls(
    session: &NormalizedSession,
    prepared: &preparation::PreparedAnalysis<'_>,
) -> DerivedCalls {
    let registry = &prepared.registry;
    let works = &prepared.works;
    let item_lookup = &prepared.item_lookup;
    let derived_transitions = &prepared.transitions;
    let destination_estimates = &prepared.destination_estimates;
    let (cumulative_usages, usage_totals) = usage_rollup(&session.model_calls);
    let (call_economics, economics_summary) =
        economics::derive_with_cost_basis(&session.model_calls, session.source.cost_basis);
    let mut model_calls = Vec::with_capacity(works.len());
    let mut cost_assessments = Vec::with_capacity(works.len());
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
            .map(|index| registry.estimate_at(*index))
            .collect::<Vec<_>>();
        let current_tokens = work
            .call
            .context_item_ids
            .iter()
            .zip(&work.estimate_indexes)
            .map(|(id, index)| (id.as_str(), registry.estimate_at(*index).tokens))
            .collect::<BTreeMap<_, _>>();
        // Transition and age metrics use every numeric estimate. System prompts
        // and tool definitions are always partial and present at every call, so
        // requiring complete estimates left these metrics empty after call 1.
        let metric_tokens = &current_tokens;
        let mut metrics_include_partial_estimates = estimates.iter().any(|estimate| {
            estimate.tokens.is_some() && estimate.coverage != TokenCoverage::Complete
        });
        let coverage = estimate_coverage(estimates.iter().copied());
        let visible_tokens = sum_map_values(&current_tokens);
        peak_calculated_visible = max_option(peak_calculated_visible, visible_tokens);
        let known_framing = framing_overhead_if_applicable(profile, work.call, item_lookup);
        let calculated_request = visible_tokens.and_then(|visible| {
            known_framing.and_then(|framing| {
                visible
                    .checked_add(framing)
                    .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
            })
        });
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
            explanation_codes.push(DiagnosticCode::ProviderUsageIncomplete);
        }
        if profile.method == TokenizationMethod::Unavailable {
            explanation_codes.push(DiagnosticCode::UnsupportedTokenizer);
        }
        if profile.method == TokenizationMethod::CharacterHeuristic {
            explanation_codes.push(DiagnosticCode::HeuristicTokenizer);
        }
        if profile.method == TokenizationMethod::ApiSerializationEstimate {
            explanation_codes.push(DiagnosticCode::EstimatedProviderSerialization);
        }
        if estimates.iter().any(|estimate| {
            estimate
                .note_codes
                .contains(&DiagnosticCode::UnsupportedImage)
        }) {
            explanation_codes.push(DiagnosticCode::UnsupportedImage);
        }
        if estimates.iter().any(|estimate| {
            estimate.note_codes.iter().any(|code| {
                matches!(
                    code,
                    DiagnosticCode::UnavailablePayload | DiagnosticCode::UnsupportedPayload
                )
            })
        }) {
            explanation_codes.push(DiagnosticCode::UnsupportedPayload);
        }
        if known_framing.is_some() {
            explanation_codes.push(DiagnosticCode::KnownFramingOverheadAvailable);
        }
        if !work.call.context_item_ids.iter().any(|id| {
            item_lookup.get(id.as_str()).is_some_and(|item| {
                item.kind == ContextItemKind::System
                    // A frozen mid-conversation update can be estimable without
                    // establishing the missing historical instruction baseline.
                    && item.metadata.get("systemUpdateOnly").map(String::as_str) != Some("true")
                    && !matches!(
                        item.payload,
                        TokenizationPayload::SystemPrompt {
                            complete: false,
                            ..
                        } | TokenizationPayload::Unavailable
                    )
            })
        }) {
            explanation_codes.push(DiagnosticCode::MissingSystemPrompt);
        }
        let incomplete_tool_definitions = work.call.context_item_ids.iter().any(|id| {
            item_lookup.get(id.as_str()).is_some_and(|item| {
                item.kind == ContextItemKind::ToolDefinition
                    && matches!(
                        item.payload,
                        TokenizationPayload::ToolDefinition {
                            complete: false,
                            ..
                        } | TokenizationPayload::Unavailable
                    )
            })
        });
        if incomplete_tool_definitions
            || (!work.call.tool_loadout_known
                && !work.call.context_item_ids.iter().any(|id| {
                    item_lookup.get(id.as_str()).is_some_and(|item| {
                        item.kind == ContextItemKind::ToolDefinition
                            && !matches!(
                                item.payload,
                                TokenizationPayload::ToolDefinition {
                                    complete: false,
                                    ..
                                } | TokenizationPayload::Unavailable
                            )
                    })
                }))
        {
            explanation_codes.push(DiagnosticCode::MissingToolDefinitions);
        }
        if estimates.iter().any(|estimate| {
            estimate
                .note_codes
                .contains(&DiagnosticCode::ModelSwitchTransformation)
        }) {
            explanation_codes.push(DiagnosticCode::ModelSwitchTransformation);
        }
        if residual.is_some_and(|value| value < 0) {
            explanation_codes.push(DiagnosticCode::NegativeResidual);
        }
        explanation_codes.sort();
        explanation_codes.dedup();

        let transition = if position == 0 {
            let added = sum_ids(&work.call.context_item_ids, metric_tokens);
            TransitionMetrics {
                added,
                retained: Some(0),
                dropped: Some(0),
                churn: None,
                reuse: None,
                // On the first call every item is added, so the share is 1 whenever defined.
                addition_share: added.filter(|total| *total > 0).map(|_| 1.0),
                removal_share: None,
            }
        } else {
            let previous = &works[position - 1].call.context_item_ids;
            let mut destination_tokens = metric_tokens.clone();
            for id in previous {
                if !destination_tokens.contains_key(id.as_str()) {
                    if let Some(estimate_index) = destination_estimates[position].get(id.as_str()) {
                        let estimate = registry.estimate_at(*estimate_index);
                        metrics_include_partial_estimates |= estimate.tokens.is_some()
                            && estimate.coverage != TokenCoverage::Complete;
                        destination_tokens.insert(id.as_str(), estimate.tokens);
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
            item_lookup,
            metric_tokens,
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
            status: status.as_str().into(),
            explanation_codes: diagnostic_strings(&explanation_codes),
            estimate_coverage: coverage,
            added_tokens: transition.added,
            retained_tokens: transition.retained,
            dropped_tokens: transition.dropped,
            churn: transition.churn,
            reuse: transition.reuse,
            addition_share: transition.addition_share,
            removal_share: transition.removal_share,
            metrics_include_partial_estimates,
            age,
        };
        let cost_assessment = assess_cost(work.call, &session.source.kind);
        let cost_assessment_api = cost_assessment.to_api();
        cost_assessments.push(cost_assessment);
        model_calls.push(to_api_call(
            work,
            &session.source.kind,
            profile,
            call_economics[position].clone(),
            ApiCallDerived {
                token_analysis,
                context_indexes: item_positions(
                    &prepared.item_positions,
                    work.call.context_item_ids.iter().map(String::as_str),
                ),
                added_indexes: item_positions(
                    &prepared.item_positions,
                    derived_transition.added_ids.iter().copied(),
                ),
                dropped_indexes: item_positions(
                    &prepared.item_positions,
                    derived_transition.dropped_ids.iter().copied(),
                ),
                transition_item_counts: derived_transition.item_counts.clone(),
                cumulative: cumulative_usages[position],
                cost_assessment: cost_assessment_api,
            },
        ));
    }

    DerivedCalls {
        model_calls,
        residual_percents,
        complete_reconciliation,
        comparable_reconciliation,
        negative_residuals,
        missing_provider_usage,
        peak_calculated_visible,
        usage_totals,
        economics_summary,
        cost_summary: pricing::summarize(&cost_assessments, pricing::embedded()),
    }
}

/// Prices a call by the time it completed, or started when that is all there is.
fn assess_cost(call: &NormalizedModelCall, harness: &str) -> pricing::CostAssessment {
    let timing = timing::call_timing(call, harness == "pi");
    pricing::assess(
        pricing::embedded(),
        pricing::CallToPrice {
            harness,
            provider: call.target.provider.as_deref(),
            model: call.target.model.as_deref(),
            at_ms: timing.recorded_at_ms.or(timing.started_at_ms),
            usage: &call.reported_usage,
        },
    )
}

struct DerivedItems {
    context_items: Vec<ContextItem>,
    item_coverage: CoverageSummary,
    total_turn_coverage: CoverageSummary,
    session_token_turns: Option<u64>,
}

fn derive_items(
    session: &NormalizedSession,
    prepared: &preparation::PreparedAnalysis<'_>,
) -> DerivedItems {
    let registry = &prepared.registry;
    let works = &prepared.works;
    let item_estimates = &prepared.item_estimates;
    let final_model_call = session.model_calls.last().map(|call| call.index);
    let mut context_items = Vec::with_capacity(session.context_items.len());
    let mut total_token_turns = Some(0_u64);
    let mut numeric_item_count = 0_usize;
    let mut has_applicable_items = false;
    let mut session_range_failed = false;
    let mut item_coverage = CoverageSummary::default();
    let mut item_turns_by_id: HashMap<&str, ItemTokenTurnsAccumulator> = HashMap::new();
    for work in works {
        for (item_id, estimate_index) in work
            .call
            .context_item_ids
            .iter()
            .zip(&work.estimate_indexes)
        {
            let accumulator = item_turns_by_id.entry(item_id.as_str()).or_default();
            let estimate = registry.estimate_at(*estimate_index);
            if let Some(tokens) = estimate.tokens {
                if let Some(total) = accumulator.token_turns {
                    accumulator.token_turns = total
                        .checked_add(tokens)
                        .filter(|value| *value <= MAX_SAFE_JSON_INTEGER);
                    if accumulator.token_turns.is_none() {
                        accumulator.range_failed = true;
                    }
                } else if !accumulator.range_failed {
                    accumulator.token_turns = Some(tokens);
                }
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
    for (item_index, item) in session.context_items.iter().enumerate() {
        let accumulator = item_turns_by_id
            .get(item.id.as_str())
            .copied()
            .unwrap_or_default();
        let covered_calls = accumulator.covered_calls;
        let complete_calls = accumulator.complete_calls;
        let partial_calls = accumulator.partial_calls;
        let unavailable_calls = accumulator.unavailable_calls;
        let total_calls = item
            .checked_presence_call_count()
            .expect("validated presence count fits call membership");
        let lifetime = item.lifetime();
        let applicable = total_calls > 0;
        let complete = applicable
            && accumulator.token_turns.is_some()
            && unavailable_calls == 0
            && partial_calls == 0
            && complete_calls == total_calls;
        let partial = applicable && accumulator.token_turns.is_some() && !complete;
        let unavailable = applicable && !complete && !partial;
        if applicable {
            has_applicable_items = true;
            session_range_failed |= accumulator.range_failed;
            if let Some(item_turns) = accumulator.token_turns {
                numeric_item_count += 1;
                let previous_total = total_token_turns;
                total_token_turns = total_token_turns.and_then(|total| {
                    total
                        .checked_add(item_turns)
                        .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
                });
                if previous_total.is_some() && total_token_turns.is_none() {
                    session_range_failed = true;
                }
            }
            item_coverage.complete_items += usize::from(complete);
            item_coverage.partial_items += usize::from(partial);
            item_coverage.unavailable_items += usize::from(unavailable);
            item_coverage.total_items += 1;
            item_coverage.covered_calls += covered_calls;
            item_coverage.total_calls += total_calls;
        }
        let estimate_dtos = item_estimates[item_index]
            .values()
            .map(|index| to_api_estimate(registry.estimate_at(*index)))
            .collect();
        let coverage = CoverageSummary {
            complete_items: usize::from(complete),
            partial_items: usize::from(partial),
            unavailable_items: usize::from(unavailable),
            total_items: usize::from(applicable),
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
            first_model_call: lifetime.map_or(0, |lifetime| lifetime.first_call),
            last_model_call: lifetime.map_or(0, |lifetime| lifetime.last_call),
            age_at_final_model_call: lifetime
                .and_then(|lifetime| lifetime.age_at(final_model_call?)),
            display_weight: item.serialized_size_bytes as f64,
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
            token_turns: if covered_calls > 0 && !accumulator.range_failed {
                accumulator.token_turns
            } else {
                None
            },
            token_turns_coverage: coverage,
        });
    }
    let session_token_turns = if session.model_calls.is_empty() {
        None
    } else if !has_applicable_items {
        Some(0)
    } else if session_range_failed || numeric_item_count == 0 {
        None
    } else {
        total_token_turns
    };
    let total_turn_coverage = if session_range_failed {
        CoverageSummary {
            complete_items: 0,
            partial_items: 0,
            unavailable_items: item_coverage.total_items,
            total_items: item_coverage.total_items,
            covered_calls: 0,
            total_calls: item_coverage.total_calls,
        }
    } else {
        item_coverage.clone()
    };
    DerivedItems {
        context_items,
        item_coverage,
        total_turn_coverage,
        session_token_turns,
    }
}

fn assemble_analysis(
    session: &NormalizedSession,
    config: AnalysisConfig,
    prepared: &preparation::PreparedAnalysis<'_>,
    calls: DerivedCalls,
    items: DerivedItems,
    analysis_started: Instant,
    metrics_ms: f64,
) -> Analysis {
    let registry = &prepared.registry;
    let works = &prepared.works;
    let all_profiles = registry.profiles().collect::<Vec<_>>();
    let DerivedCalls {
        model_calls,
        residual_percents,
        complete_reconciliation,
        comparable_reconciliation,
        negative_residuals,
        missing_provider_usage,
        peak_calculated_visible,
        usage_totals,
        economics_summary,
        cost_summary,
    } = calls;
    let DerivedItems {
        context_items,
        item_coverage,
        total_turn_coverage,
        session_token_turns,
    } = items;
    let has_tokenizable_items = works.iter().any(|work| !work.estimate_indexes.is_empty());
    let all_numeric_token_weights = config.tokenization != TokenizationPolicy::Off
        && has_tokenizable_items
        && works.iter().all(|work| {
            work.estimate_indexes
                .iter()
                .all(|index| registry.estimate_at(*index).tokens.is_some())
        });
    let chart_is_calculated_tokens = all_numeric_token_weights
        && works.iter().all(|work| {
            work.estimate_indexes.iter().all(|index| {
                let estimate = registry.estimate_at(*index);
                estimate.coverage == TokenCoverage::Complete
                    && estimate.method == TokenizationMethod::ModelTokenizer
            })
        });
    let has_partial_token_coverage = works.iter().any(|work| {
        work.estimate_indexes
            .iter()
            .any(|index| registry.estimate_at(*index).coverage == TokenCoverage::Partial)
    });
    let has_best_effort_tokenization = works.iter().any(|work| {
        work.estimate_indexes
            .iter()
            .any(|index| registry.estimate_at(*index).method != TokenizationMethod::ModelTokenizer)
    });
    let chart_is_estimated_tokens = all_numeric_token_weights && !chart_is_calculated_tokens;
    let chart_unit = if chart_is_calculated_tokens {
        ChartUnit::CalculatedTokens
    } else if chart_is_estimated_tokens {
        ChartUnit::EstimatedTokens
    } else {
        ChartUnit::Unavailable
    };
    let fallback_reason = if chart_is_calculated_tokens {
        None
    } else if chart_is_estimated_tokens {
        Some(if has_partial_token_coverage {
            ChartFallbackReason::PartialTokenCoverage
        } else if has_best_effort_tokenization {
            ChartFallbackReason::BestEffortTokenization
        } else {
            ChartFallbackReason::EstimatedTokenGeometry
        })
    } else if config.tokenization == TokenizationPolicy::Off {
        Some(ChartFallbackReason::TokenizationDisabled)
    } else {
        Some(ChartFallbackReason::ContextItemsUnavailable)
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
    let reported_completeness = usage_totals.completeness;
    let subtotals = session_usage_subtotals(&session.model_calls);
    let analysis_summary = TokenAnalysisSummary {
        policy: config.tokenization.as_str().into(),
        chart_unit: chart_unit.as_str().into(),
        fallback_reason: fallback_reason.map(|reason| reason.as_str().into()),
        profiles,
        item_estimate_coverage: item_coverage.clone(),
        calls_with_complete_reconciliation: complete_reconciliation,
        calls_with_comparable_reconciliation: comparable_reconciliation,
        tokenizer_methods: prepared.methods.clone(),
        median_absolute_residual_percent: median,
        maximum_absolute_residual_percent: maximum,
        negative_residual_calls: negative_residuals,
        calls_missing_provider_usage: missing_provider_usage,
        total_calculated_token_turns: session_token_turns,
        total_token_turns_coverage: total_turn_coverage.clone(),
    };
    if config.perf_diagnostics {
        let stats = registry.stats();
        let presence_count = session
            .context_items
            .iter()
            .try_fold(0_usize, |total, item| {
                total.checked_add(item.checked_presence_call_count()?)
            })
            .expect("validated membership count fits diagnostics");
        eprintln!(
            "analysis_perf analysis_ms={:.3} fingerprint_ms={:.3} tokenize_ms={:.3} metrics_ms={:.3} calls={} items={} presences={} unique_profiles={} unique_payloads={} estimates_calculated={} estimate_hits={} tokenizer_invocations={} fingerprint_operations={}",
            analysis_started.elapsed().as_secs_f64() * 1000.0,
            prepared.fingerprint_ms,
            prepared.tokenize_ms,
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
    Analysis {
        schema_version: ANALYSIS_SCHEMA_VERSION,
        reconstruction: None,
        token_analysis: analysis_summary,
        economics: economics_summary,
        session: SessionSummary {
            id: session.id.clone(),
            source: session.source.kind.clone(),
            title: session.title.clone(),
            working_directory: session.working_directory.clone(),
            reported_prompt_tokens: subtotals.prompt,
            reported_completion_tokens: subtotals.completion,
            reported_reasoning_tokens: subtotals.reasoning,
            reported_cost_total: subtotals.cost,
            reported_cost_coverage: subtotals.cost_coverage,
            reported_usage_completeness: reported_completeness.as_str().into(),
            reported_usage_coverage: subtotals.usage_coverage,
            calculated_token_turns: session_token_turns,
            calculated_token_turns_coverage: total_turn_coverage,
            peak_calculated_visible_tokens: peak_calculated_visible,
            reconciliation_complete_calls: complete_reconciliation,
            reconciliation_comparable_calls: comparable_reconciliation,
            median_absolute_residual_percent: median,
            maximum_absolute_residual_percent: maximum,
            negative_residual_calls: negative_residuals,
            missing_provider_usage_calls: missing_provider_usage,
            cost_summary,
        },
        display_weight_unit: chart_unit.as_str().into(),
        model_calls,
        context_items,
        compactions: session
            .compactions
            .iter()
            .map(|event| Compaction {
                id: event.id.clone(),
                before_model_call: event.before_model_call,
                source_item_ids: event.source_item_ids.clone(),
                retained_item_ids: event.retained_item_ids.clone(),
                summary_item_id: event.summary_item_id.clone(),
                tokens_before: event.tokens_before,
            })
            .collect(),
        lineage: session
            .lineage
            .iter()
            .map(|edge| Lineage {
                from: edge.from.clone(),
                to: edge.to.clone(),
                kind: edge.kind.clone(),
            })
            .collect(),
    }
}

fn to_api_call(
    work: &CallWork<'_>,
    harness: &str,
    profile: &TokenizationProfile,
    economics: CallEconomics,
    derived: ApiCallDerived,
) -> ModelCall {
    let usage = &work.call.reported_usage;
    let timing = timing::call_timing(work.call, harness == "pi");
    ModelCall {
        index: work.call.index,
        source_record_id: work.call.source_record_id.clone(),
        provider: work.call.target.provider.clone(),
        model: work.call.target.model.clone(),
        api: work.call.target.api.clone(),
        usage: Usage {
            placeholder: usage
                .placeholder
                .as_ref()
                .map(|raw| RecordedUsagePlaceholder {
                    reason: "failedAttempt",
                    input: 0,
                    output: 0,
                    cache_read: 0,
                    cache_write: 0,
                    cache_write_1h: raw.cache_write_1h,
                    reasoning: raw.reasoning,
                    total_tokens: 0,
                    cost: cost_dto(&raw.cost),
                }),
            input: usage.input,
            output: usage.output,
            recorded_output: usage.recorded_output,
            output_reasoning_relationship: usage.output_reasoning_relationship,
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
        cost: cost_dto(&usage.cost),
        stop_reason: work.call.stop_reason.clone(),
        timing,
        context_item_indexes: derived.context_indexes,
        added_item_indexes: derived.added_indexes,
        dropped_item_indexes: derived.dropped_indexes,
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
        cost_assessment: derived.cost_assessment,
    }
}

/// Every reference was resolved during validation, so lookups cannot miss.
fn item_positions<'a>(
    positions: &HashMap<&str, usize>,
    ids: impl Iterator<Item = &'a str>,
) -> Vec<usize> {
    ids.map(|id| positions[id]).collect()
}

fn cost_dto(cost: &ReportedCost) -> Option<Cost> {
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
        kind: preview.kind.as_str().into(),
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
        note_codes: diagnostic_strings(&estimate.note_codes),
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

fn framing_overhead_if_applicable(
    profile: &TokenizationProfile,
    call: &NormalizedModelCall,
    items: &HashMap<&str, &NormalizedContextItem>,
) -> Option<u64> {
    let text_only = call.context_item_ids.iter().all(|item_id| {
        let Some(item) = items.get(item_id.as_str()) else {
            return false;
        };
        match &item.payload {
            TokenizationPayload::UserMessage(content)
            | TokenizationPayload::CustomMessage(content) => {
                item.kind == ContextItemKind::UserMessage
                    && content
                        .parts
                        .iter()
                        .all(|part| matches!(part, ContentPart::Text(_)))
            }
            TokenizationPayload::AssistantMessage { blocks, .. } => {
                item.kind == ContextItemKind::AssistantMessage
                    && blocks
                        .iter()
                        .all(|block| matches!(block, AssistantContentBlock::Text(_)))
            }
            _ => false,
        }
    });
    text_only.then(|| profile.framing_overhead(call.context_item_ids.len()))?
}

fn sum_map_values(values: &BTreeMap<&str, Option<u64>>) -> Option<u64> {
    values.values().try_fold(0_u64, |total, value| {
        total
            .checked_add((*value)?)
            .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
    })
}

fn sum_ids(ids: &[String], values: &BTreeMap<&str, Option<u64>>) -> Option<u64> {
    ids.iter().try_fold(0_u64, |total, id| {
        total
            .checked_add(values.get(id.as_str()).copied().flatten()?)
            .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
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
