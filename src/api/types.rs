use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Analysis {
    pub schema_version: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reconstruction: Option<ReconstructionCoverage>,
    pub token_analysis: TokenAnalysisSummary,
    pub economics: EconomicsSummary,
    pub session: SessionSummary,
    pub display_weight_unit: String,
    pub model_calls: Vec<ModelCall>,
    pub context_items: Vec<ContextItem>,
    pub compactions: Vec<Compaction>,
    pub lineage: Vec<Lineage>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReconstructionCoverage {
    pub status: &'static str,
    pub explanation_codes: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionSummary {
    pub id: String,
    pub source: String,
    pub title: Option<String>,
    pub working_directory: Option<String>,
    pub reported_prompt_tokens: Option<u64>,
    pub reported_completion_tokens: Option<u64>,
    pub reported_reasoning_tokens: Option<u64>,
    /// Subtotal over calls with a recorded cost; `reported_cost_coverage` says how many.
    pub reported_cost_total: Option<f64>,
    pub reported_cost_coverage: RecordedCallCoverage,
    pub reported_usage_completeness: String,
    /// Prompt-token coverage of the session usage subtotals.
    pub reported_usage_coverage: RecordedCallCoverage,
    pub calculated_token_turns: Option<u64>,
    pub calculated_token_turns_coverage: CoverageSummary,
    pub peak_calculated_visible_tokens: Option<u64>,
    pub reconciliation_complete_calls: usize,
    pub reconciliation_comparable_calls: usize,
    pub median_absolute_residual_percent: Option<f64>,
    pub maximum_absolute_residual_percent: Option<f64>,
    pub negative_residual_calls: usize,
    pub missing_provider_usage_calls: usize,
    pub cost_summary: CostSummary,
    /// The harness's own running session total (Claude Code), or null. It can
    /// include calls that are not in the transcript and is never added to costs.
    pub harness_session_cost: Option<HarnessSessionCost>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HarnessSessionCost {
    pub total_usd: f64,
    /// UTC epoch milliseconds when the running total started, or null.
    pub since_ms: Option<i64>,
}

/// Billed and API-equivalent costs are kept apart: an API-equivalent cost is what a
/// subscription call would have cost at the lab's API rate, not a charge.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CostSummary {
    /// Recorded, estimated and free calls.
    pub billed: CostSubtotal,
    pub api_equivalent: CostSubtotal,
    pub unknown_calls: usize,
    pub failed_attempt_calls: usize,
    pub price_data: PriceDataSummary,
}

/// `low` and `high` differ when some calls' estimates are ranges. Both are null when
/// no call contributed.
#[derive(Debug, Clone, Copy, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CostSubtotal {
    pub low: Option<f64>,
    pub high: Option<f64>,
    pub calls: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PriceDataSummary {
    pub models_dev_commit: String,
    pub models_dev_committed_at: String,
    pub amendments_imported_from: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CostAssessment {
    /// "recorded", "estimated", "apiEquivalent", "free" or "unknown".
    pub kind: &'static str,
    /// The low end when the amount is a range.
    pub amount: Option<f64>,
    /// Set only when the amount is a range.
    pub amount_high: Option<f64>,
    pub recorded_by_harness: Option<f64>,
    /// "perToken" or "subscription"; null when the call could not be classified.
    pub billing_mode: Option<&'static str>,
    pub classification_rule: &'static str,
    pub rate: Option<CostRate>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CostRate {
    pub provider: String,
    pub model: String,
    /// A lab's API rate used for a call on another provider (subscriptions only).
    pub lab_equivalent: bool,
    /// When this rate started; null for a model's first listed rate.
    pub valid_from: Option<String>,
    /// "documented", "firstObserved" or "modelsDevCommit".
    pub start_basis: &'static str,
    pub source: String,
}

/// How many calls contributed to a session subtotal. Failed attempts are
/// counted separately: their default-zero counters are not measurements.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecordedCallCoverage {
    pub recorded_calls: usize,
    pub failed_attempt_calls: usize,
    pub missing_calls: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TokenAnalysisSummary {
    pub policy: String,
    pub chart_unit: String,
    pub fallback_reason: Option<String>,
    pub profiles: Vec<TokenizationProfileSummary>,
    pub item_estimate_coverage: CoverageSummary,
    pub calls_with_complete_reconciliation: usize,
    pub calls_with_comparable_reconciliation: usize,
    pub tokenizer_methods: BTreeMap<String, usize>,
    pub median_absolute_residual_percent: Option<f64>,
    pub maximum_absolute_residual_percent: Option<f64>,
    pub negative_residual_calls: usize,
    pub calls_missing_provider_usage: usize,
    pub total_calculated_token_turns: Option<u64>,
    pub total_token_turns_coverage: CoverageSummary,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TokenizationProfileSummary {
    pub id: String,
    pub provider: String,
    pub model: String,
    pub api: Option<String>,
    pub tokenizer_family: String,
    pub method: String,
    pub version: u32,
    pub rule: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CoverageSummary {
    pub complete_items: usize,
    pub partial_items: usize,
    pub unavailable_items: usize,
    pub total_items: usize,
    pub covered_calls: usize,
    pub total_calls: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ModelCall {
    pub index: usize,
    pub source_record_id: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub api: Option<String>,
    pub usage: Usage,
    pub reported_prompt_tokens: Option<u64>,
    pub reported_completion_tokens: Option<u64>,
    pub reported_total_tokens: Option<u64>,
    pub reported_usage_completeness: String,
    pub cumulative_reported_prompt_tokens: Option<u64>,
    pub cumulative_reported_completion_tokens: Option<u64>,
    pub cumulative_reported_reasoning_tokens: Option<u64>,
    pub cumulative_reported_usage_completeness: String,
    pub cost: Option<Cost>,
    pub stop_reason: Option<String>,
    pub timing: CallTiming,
    /// Positions in `Analysis::context_items`, in this call's context order.
    /// Positions rather than IDs keep the response proportional to the source.
    pub context_item_indexes: Vec<usize>,
    pub added_item_indexes: Vec<usize>,
    pub dropped_item_indexes: Vec<usize>,
    pub transition_item_counts: TransitionItemCounts,
    pub tool_calls_after: Vec<ToolCall>,
    pub compaction_before: Option<String>,
    pub tokenization_profile_id: Option<String>,
    pub token_analysis: CallTokenAnalysis,
    pub economics: CallEconomics,
    pub cost_assessment: CostAssessment,
}

/// Approximate client-observed timing, never provider decode speed or TTFT.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CallTiming {
    pub started_at_ms: Option<i64>,
    pub recorded_at_ms: Option<i64>,
    pub duration_ms: Option<u64>,
    pub effective_output_tokens_per_second: Option<f64>,
    pub basis: Option<&'static str>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CallEconomics {
    pub policy_id: Option<String>,
    pub usage_completeness: EconomicsCompleteness,
    pub cost_completeness: EconomicsCompleteness,
    pub cache_write_status: CacheWriteStatus,
    pub prompt_tokens: Option<u64>,
    pub cache_read_ratio: Option<f64>,
    pub cache_write_ratio: Option<f64>,
    pub fresh_ratio: Option<f64>,
    pub pi_prompt_cost: Option<f64>,
    pub cache_ratio_discontinuity: Option<CacheRatioDiscontinuity>,
    pub explanation_codes: Vec<String>,
}

impl CallEconomics {
    pub(crate) fn unsupported() -> Self {
        Self {
            policy_id: None,
            usage_completeness: EconomicsCompleteness::Unsupported,
            cost_completeness: EconomicsCompleteness::Unsupported,
            cache_write_status: CacheWriteStatus::Unsupported,
            prompt_tokens: None,
            cache_read_ratio: None,
            cache_write_ratio: None,
            fresh_ratio: None,
            pi_prompt_cost: None,
            cache_ratio_discontinuity: None,
            explanation_codes: vec!["unsupportedEconomicsPolicy".into()],
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum EconomicsCompleteness {
    Complete,
    Partial,
    Missing,
    Unsupported,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CacheWriteStatus {
    Reported,
    NotReported,
    NotRetainedByPi,
    Unsupported,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CacheRatioDirection {
    Drop,
    Rise,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CacheRatioChangeMagnitude {
    Notable,
    Large,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CacheRatioDiscontinuity {
    pub previous_call_index: usize,
    pub direction: CacheRatioDirection,
    pub previous_ratio: f64,
    pub current_ratio: f64,
    pub delta: f64,
    pub magnitude: CacheRatioChangeMagnitude,
    pub method: &'static str,
    pub previous_prompt_tokens: u64,
    pub current_prompt_tokens: u64,
    pub compaction_before: Option<String>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum EconomicsCostBasis {
    #[default]
    PiModelRates,
    SourceModelRates,
    ProviderReported,
    Unknown,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EconomicsStatusCounts {
    pub complete: usize,
    pub partial: usize,
    pub missing: usize,
    pub unsupported: usize,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EconomicsSummary {
    pub cost_basis: EconomicsCostBasis,
    pub supported_policy_ids: Vec<String>,
    pub usage_completeness: EconomicsStatusCounts,
    pub cost_completeness: EconomicsStatusCounts,
    pub cache_read_eligible_calls: usize,
    pub cache_read_prompt_tokens: Option<u64>,
    pub cache_read_tokens: Option<u64>,
    pub cache_read_ratio: Option<f64>,
    pub explanation_codes: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TransitionItemCounts {
    pub added: usize,
    pub retained: usize,
    pub dropped: usize,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Usage {
    pub placeholder: Option<RecordedUsagePlaceholder>,
    pub input: Option<u64>,
    /// Normalized completion total, not necessarily the raw source output bucket.
    pub output: Option<u64>,
    pub recorded_output: Option<u64>,
    pub output_reasoning_relationship: crate::domain::OutputReasoningRelationship,
    pub cache_read: Option<u64>,
    pub cache_write: Option<u64>,
    pub cache_write_1h: Option<u64>,
    pub reasoning: Option<u64>,
    pub total_tokens: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecordedUsagePlaceholder {
    pub reason: &'static str,
    pub input: u64,
    pub output: u64,
    pub cache_read: u64,
    pub cache_write: u64,
    pub cache_write_1h: Option<u64>,
    pub reasoning: Option<u64>,
    pub total_tokens: u64,
    pub cost: Option<Cost>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Cost {
    pub input: Option<f64>,
    pub output: Option<f64>,
    pub cache_read: Option<f64>,
    pub cache_write: Option<f64>,
    pub total: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ToolCall {
    pub id: String,
    pub name: String,
    pub failed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ContextItem {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub preview: Option<ContextItemPreview>,
    pub source_record_id: Option<String>,
    pub source_tool_call_id: Option<String>,
    pub first_model_call: usize,
    pub last_model_call: usize,
    pub age_at_final_model_call: Option<usize>,
    pub display_weight: f64,
    pub presence: Vec<Range>,
    pub presence_call_count: usize,
    pub metadata: BTreeMap<String, String>,
    pub token_estimates: Vec<ContextItemTokenEstimate>,
    pub token_turns: Option<u64>,
    pub token_turns_coverage: CoverageSummary,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ContextItemPreview {
    pub text: String,
    pub kind: String,
    pub truncated: bool,
    pub expanded_text: String,
    pub expanded_truncated: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ContextItemTokenEstimate {
    pub profile_id: String,
    pub tokens: Option<u64>,
    pub method: String,
    pub coverage: String,
    pub note_codes: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CallTokenAnalysis {
    pub reported_prompt_tokens: Option<u64>,
    pub reported_completion_tokens: Option<u64>,
    pub reported_total_tokens: Option<u64>,
    pub reported_usage_completeness: String,
    pub calculated_visible_tokens: Option<u64>,
    pub known_framing_overhead_tokens: Option<u64>,
    pub calculated_request_tokens: Option<u64>,
    pub residual_tokens: Option<i64>,
    pub residual_percent: Option<f64>,
    pub status: String,
    pub explanation_codes: Vec<String>,
    pub estimate_coverage: CoverageSummary,
    pub added_tokens: Option<u64>,
    pub retained_tokens: Option<u64>,
    pub dropped_tokens: Option<u64>,
    pub churn: Option<f64>,
    pub reuse: Option<f64>,
    pub addition_share: Option<f64>,
    pub removal_share: Option<f64>,
    /// True when added/retained/dropped tokens, churn, reuse, shares or
    /// token-weighted age include partial (approximate) item estimates.
    pub metrics_include_partial_estimates: bool,
    pub age: CallAgeMetrics,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CallAgeMetrics {
    pub oldest_live_item_age_calls: Option<usize>,
    pub median_live_item_age_calls: Option<f64>,
    pub token_weighted_mean_age_calls: Option<f64>,
    pub tokens_at_least_5_calls_old: Option<u64>,
    pub tokens_at_least_10_calls_old: Option<u64>,
    pub tokens_at_least_20_calls_old: Option<u64>,
    pub items_at_least_5_calls_old: usize,
    pub items_at_least_10_calls_old: usize,
    pub items_at_least_20_calls_old: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Range {
    pub start_call: usize,
    pub end_call: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Compaction {
    pub id: String,
    pub before_model_call: usize,
    pub source_item_ids: Vec<String>,
    pub retained_item_ids: Vec<String>,
    pub summary_item_id: String,
    pub tokens_before: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct Lineage {
    pub from: String,
    pub to: String,
    pub kind: String,
}
