use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Analysis {
    pub schema_version: u32,
    pub token_analysis: TokenAnalysisSummary,
    pub session: SessionSummary,
    pub display_weight_unit: String,
    pub model_calls: Vec<ModelCall>,
    pub context_items: Vec<ContextItem>,
    pub compactions: Vec<Compaction>,
    pub lineage: Vec<Lineage>,
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
    pub reported_cost_total: Option<f64>,
    pub reported_usage_completeness: String,
    pub calculated_token_turns: Option<u64>,
    pub calculated_token_turns_coverage: CoverageSummary,
    pub peak_calculated_visible_tokens: Option<u64>,
    pub reconciliation_complete_calls: usize,
    pub reconciliation_comparable_calls: usize,
    pub median_absolute_residual_percent: Option<f64>,
    pub maximum_absolute_residual_percent: Option<f64>,
    pub negative_residual_calls: usize,
    pub missing_provider_usage_calls: usize,
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
    pub context_item_ids: Vec<String>,
    pub added_item_ids: Vec<String>,
    pub dropped_item_ids: Vec<String>,
    pub transition_item_counts: TransitionItemCounts,
    pub tool_calls_after: Vec<ToolCall>,
    pub compaction_before: Option<String>,
    pub tokenization_profile_id: Option<String>,
    pub token_analysis: CallTokenAnalysis,
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
    pub input: Option<u64>,
    pub output: Option<u64>,
    pub cache_read: Option<u64>,
    pub cache_write: Option<u64>,
    pub cache_write_1h: Option<u64>,
    pub reasoning: Option<u64>,
    pub total_tokens: Option<u64>,
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
