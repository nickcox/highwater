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
mod timing;
mod tokenization;

use crate::{api::*, domain::*};
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

pub(crate) use tokenization::TokenizationPolicy;

pub(crate) const ANALYSIS_SCHEMA_VERSION: u32 = 9;
// Bump this when serialized analysis output can change without a schema change.
pub(crate) const ANALYSIS_OUTPUT_VERSION: u32 = 19;

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

#[derive(Debug)]
struct ValidatedSession<'a> {
    item_indices: HashMap<&'a str, usize>,
    compaction_indices: HashMap<&'a str, usize>,
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

fn invalid_session(message: impl Into<String>) -> AnalysisError {
    AnalysisError::InvalidSession(message.into())
}

fn require_safe_integer(value: u64, field: &str) -> Result<(), AnalysisError> {
    if value > MAX_SAFE_JSON_INTEGER {
        return Err(invalid_session(format!(
            "{field} exceeds the safe JSON integer range"
        )));
    }
    Ok(())
}

fn validate_reported_usage(usage: &ReportedUsage, call_index: usize) -> Result<(), AnalysisError> {
    for (field, value) in [
        ("input", usage.input),
        ("output", usage.output),
        ("cacheRead", usage.cache_read),
        ("cacheWrite", usage.cache_write),
        ("cacheWrite1h", usage.cache_write_1h),
        ("reasoning", usage.reasoning),
        ("totalTokens", usage.total_tokens),
    ] {
        if let Some(value) = value {
            require_safe_integer(value, &format!("call {call_index} usage.{field}"))?;
        }
    }
    for (field, value) in [
        ("input", usage.cost.input),
        ("output", usage.cost.output),
        ("cacheRead", usage.cost.cache_read),
        ("cacheWrite", usage.cost.cache_write),
        ("total", usage.cost.total),
    ] {
        if let Some(value) = value {
            if !value.is_finite() {
                return Err(invalid_session(format!(
                    "call {call_index} cost.{field} is not finite"
                )));
            }
        }
    }
    Ok(())
}

fn validate_payload_numbers(
    payload: &TokenizationPayload,
    item_id: &str,
) -> Result<(), AnalysisError> {
    let validate_image = |image: &ImageDescriptor| {
        image.encoded_data_length.map_or(Ok(()), |length| {
            require_safe_integer(length, &format!("item {item_id} encoded image data length"))
        })
    };
    match payload {
        TokenizationPayload::UserMessage(content) | TokenizationPayload::CustomMessage(content) => {
            for part in &content.parts {
                if let ContentPart::Image(image) = part {
                    validate_image(image)?;
                }
            }
        }
        TokenizationPayload::AssistantMessage { blocks, .. } => {
            for block in blocks {
                if let AssistantContentBlock::Image(image) = block {
                    validate_image(image)?;
                }
            }
        }
        TokenizationPayload::ToolResult { content, .. } => {
            for part in &content.parts {
                if let ContentPart::Image(image) = part {
                    validate_image(image)?;
                }
            }
        }
        TokenizationPayload::SystemPrompt { .. }
        | TokenizationPayload::ToolDefinition { .. }
        | TokenizationPayload::CompactionSummary(_)
        | TokenizationPayload::BranchSummary(_)
        | TokenizationPayload::CommandExecution { .. }
        | TokenizationPayload::Unavailable => {}
    }
    Ok(())
}

fn validate_normalized_session(
    session: &NormalizedSession,
) -> Result<ValidatedSession<'_>, AnalysisError> {
    let mut item_indices = HashMap::with_capacity(session.context_items.len());
    for (index, item) in session.context_items.iter().enumerate() {
        if item_indices.insert(item.id.as_str(), index).is_some() {
            return Err(invalid_session(format!(
                "duplicate context item ID {}",
                item.id
            )));
        }
        require_safe_integer(
            item.serialized_size_bytes,
            &format!("item {} serialized size bytes", item.id),
        )?;
        validate_payload_numbers(&item.payload, &item.id)?;
    }

    let call_count = session.model_calls.len();
    let terminal_boundary = call_count
        .checked_add(1)
        .ok_or_else(|| invalid_session("model-call boundary overflow"))?;
    let mut expected_presence: HashMap<&str, Vec<PresenceRange>> = HashMap::new();
    for (position, call) in session.model_calls.iter().enumerate() {
        let expected_index = position
            .checked_add(1)
            .ok_or_else(|| invalid_session("model-call index overflow"))?;
        if call.index != expected_index {
            return Err(invalid_session(format!(
                "model-call indexes must be contiguous one-based values; expected {expected_index}, got {}",
                call.index
            )));
        }
        require_safe_integer(
            u64::try_from(call.index).map_err(|_| invalid_session("model-call index overflow"))?,
            &format!("model-call {} index", call.index),
        )?;
        validate_reported_usage(&call.reported_usage, call.index)?;
        let mut membership = HashSet::with_capacity(call.context_item_ids.len());
        for item_id in &call.context_item_ids {
            if !membership.insert(item_id.as_str()) {
                return Err(invalid_session(format!(
                    "model call {} contains duplicate item reference {}",
                    call.index, item_id
                )));
            }
            if !item_indices.contains_key(item_id.as_str()) {
                return Err(invalid_session(format!(
                    "model call {} references unknown item {}",
                    call.index, item_id
                )));
            }
            let ranges = expected_presence.entry(item_id.as_str()).or_default();
            if ranges
                .last()
                .is_some_and(|range| range.end_call.checked_add(1) == Some(call.index))
            {
                ranges.last_mut().expect("checked last range").end_call = call.index;
            } else {
                ranges.push(PresenceRange {
                    start_call: call.index,
                    end_call: call.index,
                });
            }
        }
    }

    let mut compaction_indices = HashMap::with_capacity(session.compactions.len());
    let mut summary_ids = HashSet::with_capacity(session.compactions.len());
    let mut terminal_summary_ids = HashSet::new();
    for (compaction_index, compaction) in session.compactions.iter().enumerate() {
        if compaction_indices
            .insert(compaction.id.as_str(), compaction_index)
            .is_some()
        {
            return Err(invalid_session(format!(
                "duplicate compaction ID {}",
                compaction.id
            )));
        }
        if compaction.before_model_call == 0 || compaction.before_model_call > terminal_boundary {
            return Err(invalid_session(format!(
                "compaction {} has an invalid call boundary",
                compaction.id
            )));
        }
        require_safe_integer(
            u64::try_from(compaction.before_model_call)
                .map_err(|_| invalid_session("compaction boundary overflow"))?,
            &format!("compaction {} boundary", compaction.id),
        )?;
        if !summary_ids.insert(compaction.summary_item_id.as_str()) {
            return Err(invalid_session(format!(
                "duplicate compaction summary reference {}",
                compaction.summary_item_id
            )));
        }
        let Some(summary_index) = item_indices.get(compaction.summary_item_id.as_str()) else {
            return Err(invalid_session(format!(
                "compaction {} references unknown summary {}",
                compaction.id, compaction.summary_item_id
            )));
        };
        let summary = &session.context_items[*summary_index];
        if summary.kind != ContextItemKind::CompactionSummary {
            return Err(invalid_session(format!(
                "compaction {} summary {} has the wrong item kind",
                compaction.id, compaction.summary_item_id
            )));
        }
        if compaction.before_model_call == terminal_boundary {
            terminal_summary_ids.insert(compaction.summary_item_id.as_str());
        }
        require_safe_integer(
            compaction.tokens_before.unwrap_or(0),
            &format!("compaction {} tokensBefore", compaction.id),
        )?;
        let mut source_ids = HashSet::with_capacity(compaction.source_item_ids.len());
        for item_id in &compaction.source_item_ids {
            if !source_ids.insert(item_id.as_str()) {
                return Err(invalid_session(format!(
                    "compaction {} contains duplicate source item {}",
                    compaction.id, item_id
                )));
            }
            if !item_indices.contains_key(item_id.as_str()) {
                return Err(invalid_session(format!(
                    "compaction {} references unknown source item {}",
                    compaction.id, item_id
                )));
            }
        }
        let mut retained_ids = HashSet::with_capacity(compaction.retained_item_ids.len());
        for item_id in &compaction.retained_item_ids {
            if !retained_ids.insert(item_id.as_str()) {
                return Err(invalid_session(format!(
                    "compaction {} contains duplicate retained item {}",
                    compaction.id, item_id
                )));
            }
            if source_ids.contains(item_id.as_str()) {
                return Err(invalid_session(format!(
                    "compaction {} repeats item {} in source and retained lists",
                    compaction.id, item_id
                )));
            }
            if !item_indices.contains_key(item_id.as_str()) {
                return Err(invalid_session(format!(
                    "compaction {} references unknown retained item {}",
                    compaction.id, item_id
                )));
            }
        }
    }

    for call in &session.model_calls {
        if let Some(compaction_id) = call.compaction_before.as_deref() {
            let Some(compaction_index) = compaction_indices.get(compaction_id) else {
                return Err(invalid_session(format!(
                    "model call {} references unknown compaction {}",
                    call.index, compaction_id
                )));
            };
            let compaction = &session.compactions[*compaction_index];
            if compaction.before_model_call != call.index {
                return Err(invalid_session(format!(
                    "model call {} has a mismatched compaction boundary {}",
                    call.index, compaction_id
                )));
            }
        }
    }

    for edge in &session.lineage {
        if !item_indices.contains_key(edge.from.as_str())
            || !item_indices.contains_key(edge.to.as_str())
        {
            return Err(invalid_session(format!(
                "lineage edge {} -> {} references an unknown item",
                edge.from, edge.to
            )));
        }
    }

    for item in &session.context_items {
        let expected = expected_presence
            .get(item.id.as_str())
            .map(Vec::as_slice)
            .unwrap_or_default();
        if item.presence.is_empty() {
            if !expected.is_empty()
                || item.first_model_call != 0
                || item.last_model_call != 0
                || !summary_ids.contains(item.id.as_str())
            {
                return Err(invalid_session(format!(
                    "item {} has no presence but is not a structural compaction summary",
                    item.id
                )));
            }
            continue;
        }
        if terminal_summary_ids.contains(item.id.as_str()) {
            return Err(invalid_session(format!(
                "terminal compaction summary {} has presence",
                item.id
            )));
        }
        let mut previous_end = 0;
        for range in &item.presence {
            if range.start_call == 0
                || range.start_call > range.end_call
                || range.end_call > call_count
                || range.start_call <= previous_end
                || range.checked_call_count().is_none()
            {
                return Err(invalid_session(format!(
                    "item {} has an invalid or overlapping presence range",
                    item.id
                )));
            }
            previous_end = range.end_call;
        }
        if item.presence.as_slice() != expected
            || item.first_model_call != item.presence[0].start_call
            || item.last_model_call != previous_end
        {
            return Err(invalid_session(format!(
                "item {} lifetime or presence does not match call membership",
                item.id
            )));
        }
    }

    Ok(ValidatedSession {
        item_indices,
        compaction_indices,
    })
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
        let metric_tokens = work
            .call
            .context_item_ids
            .iter()
            .zip(&work.estimate_indexes)
            .map(|(id, index)| {
                let estimate = registry.estimate_at(*index);
                (
                    id.as_str(),
                    (estimate.coverage == TokenCoverage::Complete)
                        .then_some(estimate.tokens)
                        .flatten(),
                )
            })
            .collect::<BTreeMap<_, _>>();
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
                if !destination_tokens.contains_key(id.as_str()) {
                    if let Some(estimate_index) = destination_estimates[position].get(id.as_str()) {
                        let estimate = registry.estimate_at(*estimate_index);
                        destination_tokens.insert(
                            id.as_str(),
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
            item_lookup,
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
            age,
        };
        model_calls.push(to_api_call(
            work,
            session.source.kind == "pi",
            profile,
            call_economics[position].clone(),
            ApiCallDerived {
                token_analysis,
                added_ids: derived_transition
                    .added_ids
                    .iter()
                    .map(|id| (*id).to_owned())
                    .collect(),
                dropped_ids: derived_transition
                    .dropped_ids
                    .iter()
                    .map(|id| (*id).to_owned())
                    .collect(),
                transition_item_counts: derived_transition.item_counts.clone(),
                cumulative: cumulative_usages[position],
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
    }
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
    let reported_prompt = usage_totals.prompt;
    let reported_completeness = usage_totals.completeness;
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
            reported_prompt_tokens: reported_prompt,
            reported_completion_tokens: usage_totals.completion,
            reported_reasoning_tokens: usage_totals.reasoning,
            reported_cost_total: usage_cost_total(&session.model_calls),
            reported_usage_completeness: reported_completeness.as_str().into(),
            calculated_token_turns: session_token_turns,
            calculated_token_turns_coverage: total_turn_coverage,
            peak_calculated_visible_tokens: peak_calculated_visible,
            reconciliation_complete_calls: complete_reconciliation,
            reconciliation_comparable_calls: comparable_reconciliation,
            median_absolute_residual_percent: median,
            maximum_absolute_residual_percent: maximum,
            negative_residual_calls: negative_residuals,
            missing_provider_usage_calls: missing_provider_usage,
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
    pi_source: bool,
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
        timing: timing::call_timing(work.call, pi_source),
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
                    if let Some(total) = self
                        .prompt_sum
                        .checked_add(value)
                        .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
                    {
                        self.prompt_sum = total;
                    } else {
                        self.prompt_overflow = true;
                        self.prompt_complete = false;
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
            if let Some(total) = self
                .output_sum
                .checked_add(value)
                .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
            {
                self.output_sum = total;
            } else {
                self.output_complete = false;
            }
        } else {
            self.output_complete = false;
        }
        if let Some(value) = call.reported_usage.reasoning {
            if let Some(total) = self
                .reasoning_sum
                .checked_add(value)
                .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
            {
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

    use super::test_support::{analysis_with_controlled_estimates, fake_session};

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
    fn item_token_turn_overflow_is_sticky_and_invalidates_session_subtotals() {
        let mut session = fake_session();
        let mut safe_item = session.context_items[0].clone();
        safe_item.id = "safe-item".into();
        safe_item.payload =
            TokenizationPayload::UserMessage(MessageContent::text("distinct payload"));
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
            },
        )
        .expect_err("inverted ranges must fail");
        assert!(
            matches!(error, AnalysisError::InvalidSession(message) if message.contains("invalid"))
        );
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
