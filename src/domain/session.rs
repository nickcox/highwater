//! Source-neutral records. Presence is authoritative; lifetime zeros are legacy boundary fields.

#[cfg(test)]
mod tests;

use super::source::CostBasis;
use std::collections::BTreeMap;

/// Largest integer that can be represented exactly by the TypeScript/JSON contract.
pub(crate) const MAX_SAFE_JSON_INTEGER: u64 = 9_007_199_254_740_991;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SourceDescriptor {
    pub kind: String,
    pub version: String,
    pub cost_basis: CostBasis,
}

#[derive(Debug, Clone)]
pub(crate) struct NormalizedSession {
    pub id: String,
    pub source: SourceDescriptor,
    pub title: Option<String>,
    pub working_directory: Option<String>,
    pub context_items: Vec<NormalizedContextItem>,
    pub model_calls: Vec<NormalizedModelCall>,
    pub compactions: Vec<NormalizedCompaction>,
    pub lineage: Vec<NormalizedLineageEdge>,
    pub harness_session_cost: Option<HarnessSessionCost>,
}

/// A session total the harness calculated itself (Claude Code's `cost-state`).
/// It is a running total since `since_ms` and can include calls that are not in
/// the transcript, so it is never added to call costs or spread across calls.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct HarnessSessionCost {
    pub total_usd: f64,
    pub since_ms: Option<i64>,
}

#[derive(Debug, Clone)]
pub(crate) struct NormalizedModelCall {
    /// Verified recorded loadout baseline, including an explicitly empty one.
    pub tool_loadout_known: bool,
    pub index: usize,
    pub source_record_id: String,
    pub target: ModelTarget,
    pub reported_usage: ReportedUsage,
    pub stop_reason: Option<String>,
    pub timestamps: CallTimestamps,
    pub context_item_ids: Vec<String>,
    pub tool_calls_after: Vec<NormalizedToolCall>,
    pub compaction_before: Option<String>,
}

/// Source wall-clock instants, retained independently of timing derivation.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct CallTimestamps {
    pub started_at_ms: Option<i64>,
    pub recorded_at_ms: Option<i64>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Hash)]
pub(crate) struct ModelTarget {
    pub provider: Option<String>,
    pub model: Option<String>,
    pub api: Option<String>,
}

/// Relationship between the source's recorded output bucket and reasoning.
/// This describes counters, never inferred from displayed reasoning text.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum OutputReasoningRelationship {
    IncludesReasoning,
    ExcludesReasoning,
    #[default]
    Unknown,
}

#[derive(Debug, Clone, Default)]
pub(crate) struct ReportedUsage {
    /// Raw default-zero counters from an unsuccessful attempt, not measurements.
    /// Qualified accounting fields below remain absent when this is present.
    pub placeholder: Option<PlaceholderUsage>,
    pub input: Option<u64>,
    /// Normalized completion total, including reasoning exactly once when known.
    pub output: Option<u64>,
    /// Uncombined output counter supplied by the source, independent of total availability.
    pub recorded_output: Option<u64>,
    pub output_reasoning_relationship: OutputReasoningRelationship,
    pub cache_read: Option<u64>,
    pub cache_write: Option<u64>,
    pub cache_write_1h: Option<u64>,
    pub reasoning: Option<u64>,
    pub total_tokens: Option<u64>,
    pub cost: ReportedCost,
}

#[derive(Debug, Clone)]
pub(crate) struct PlaceholderUsage {
    // The five core counters were explicitly recorded as zero. Keep optional
    // breakdown missingness and original cost components for inspection.
    pub cache_write_1h: Option<u64>,
    pub reasoning: Option<u64>,
    pub cost: ReportedCost,
}

#[derive(Debug, Clone, Default)]
pub(crate) struct ReportedCost {
    pub input: Option<f64>,
    pub output: Option<f64>,
    pub cache_read: Option<f64>,
    pub cache_write: Option<f64>,
    pub total: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct NormalizedToolCall {
    pub id: String,
    pub name: String,
    pub failed: bool,
}

#[derive(Debug, Clone)]
pub(crate) struct NormalizedContextItem {
    pub id: String,
    pub kind: ContextItemKind,
    pub label: String,
    pub source_record_id: Option<String>,
    pub source_tool_call_id: Option<String>,
    pub metadata: BTreeMap<String, String>,
    /// Source-provided serialized bytes, never a token-geometry fallback.
    /// Assembly retains the legacy `displayWeight` wire field for this diagnostic.
    pub serialized_size_bytes: u64,
    pub payload: TokenizationPayload,
    pub presence: Vec<PresenceRange>,
    pub first_model_call: usize,
    pub last_model_call: usize,
}

impl NormalizedContextItem {
    /// A response's thinking, sized by the reasoning tokens reported for it. Anthropic
    /// sends thinking back with later requests and bills it as input, rebuilding it from
    /// the block's signature whatever text the transcript shows.
    pub(crate) fn reported_thinking(
        id: String,
        source_record_id: Option<String>,
        tokens: u64,
        model: String,
    ) -> Self {
        Self {
            id,
            kind: ContextItemKind::Thinking,
            label: format!("Thinking · {} reported tokens", grouped(tokens)),
            source_record_id,
            source_tool_call_id: None,
            metadata: BTreeMap::from([("reasoningTokens".into(), tokens.to_string())]),
            serialized_size_bytes: 0,
            payload: TokenizationPayload::ReportedThinking {
                tokens,
                source_model: Some(model),
            },
            presence: Vec::new(),
            first_model_call: 0,
            last_model_call: 0,
        }
    }

    /// Derived from authoritative presence, not the legacy zero lifetime sentinel.
    /// Analysis callers validate all ranges and call membership before deriving metrics.
    pub(crate) fn lifetime(&self) -> Option<ItemLifetime> {
        let first_call = self.presence.first()?.start_call;
        let last_call = self.presence.last()?.end_call;
        PresenceRange {
            start_call: first_call,
            end_call: last_call,
        }
        .checked_call_count()?;
        Some(ItemLifetime {
            first_call,
            last_call,
        })
    }

    pub(crate) fn checked_presence_call_count(&self) -> Option<usize> {
        self.presence.iter().try_fold(0_usize, |count, range| {
            count.checked_add(range.checked_call_count()?)
        })
    }
}

/// `1234567` as `1,234,567`.
fn grouped(value: u64) -> String {
    let digits = value.to_string();
    let mut out = String::new();
    for (position, digit) in digits.chars().enumerate() {
        if position > 0 && (digits.len() - position).is_multiple_of(3) {
            out.push(',');
        }
        out.push(digit);
    }
    out
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct ItemLifetime {
    pub first_call: usize,
    pub last_call: usize,
}

impl ItemLifetime {
    pub(crate) fn age_at(self, call_index: usize) -> Option<usize> {
        call_index.checked_sub(self.first_call)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) enum ContextItemKind {
    System,
    ToolDefinition,
    UserMessage,
    AssistantMessage,
    ToolResult,
    CompactionSummary,
    CustomMessage,
    BranchSummary,
    /// A response's thinking, sized by the reasoning tokens the provider reported.
    Thinking,
    Other,
}

impl ContextItemKind {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::System => "system",
            Self::ToolDefinition => "toolDefinition",
            Self::UserMessage => "userMessage",
            Self::AssistantMessage => "assistantMessage",
            Self::ToolResult => "toolResult",
            Self::CompactionSummary => "compactionSummary",
            Self::CustomMessage => "customMessage",
            Self::BranchSummary => "branchSummary",
            Self::Thinking => "thinking",
            Self::Other => "other",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct PresenceRange {
    pub start_call: usize,
    pub end_call: usize,
}

impl PresenceRange {
    /// Return the inclusive number of calls covered by this range when it is valid.
    pub(crate) fn checked_call_count(&self) -> Option<usize> {
        if self.start_call == 0 {
            return None;
        }
        self.end_call
            .checked_sub(self.start_call)
            .and_then(|count| count.checked_add(1))
    }
}

#[derive(Debug, Clone)]
pub(crate) struct NormalizedCompaction {
    pub id: String,
    pub before_model_call: usize,
    pub source_item_ids: Vec<String>,
    pub retained_item_ids: Vec<String>,
    pub summary_item_id: String,
    pub tokens_before: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct NormalizedLineageEdge {
    pub from: String,
    pub to: String,
    pub kind: String,
}

#[derive(Debug, Clone)]
pub(crate) enum TokenizationPayload {
    UserMessage(MessageContent),
    AssistantMessage {
        blocks: Vec<AssistantContentBlock>,
        source_provider: Option<String>,
        source_model: Option<String>,
        source_api: Option<String>,
        /// The response's thinking is a separate `ReportedThinking` item, so the
        /// recorded thinking text (empty or a summary) is not counted here.
        thinking_reported: bool,
    },
    ToolResult {
        tool_call_id: String,
        tool_name: String,
        content: MessageContent,
        is_error: bool,
    },
    CustomMessage(MessageContent),
    /// Replayed logical instructions; provider wire framing remains estimated.
    SystemPrompt {
        text: String,
        complete: bool,
    },
    /// Recorded declaration JSON, not a universal provider wire representation.
    ToolDefinition {
        text: String,
        complete: bool,
    },
    CompactionSummary(String),
    BranchSummary(String),
    /// Thinking the provider sends back with later requests. Its size is the
    /// producing response's reported reasoning tokens; only the model that
    /// produced it reads it.
    ReportedThinking {
        tokens: u64,
        source_model: Option<String>,
    },
    // Source-neutral capability exercised by analysis tests; Pi command-shaped
    // records are ignored and do not construct this payload.
    #[cfg_attr(not(test), allow(dead_code))]
    CommandExecution {
        command: String,
        output: String,
        excluded_from_context: bool,
    },
    Unavailable,
}

#[derive(Debug, Clone)]
pub(crate) struct MessageContent {
    pub parts: Vec<ContentPart>,
}

impl MessageContent {
    pub(crate) fn text(text: impl Into<String>) -> Self {
        Self {
            parts: vec![ContentPart::Text(text.into())],
        }
    }

    pub(crate) fn empty() -> Self {
        Self { parts: Vec::new() }
    }
}

#[derive(Debug, Clone)]
pub(crate) enum AssistantContentBlock {
    Text(String),
    Thinking {
        text: String,
        provider_signature: Option<String>,
    },
    ToolCall {
        id: String,
        name: String,
        arguments: String,
    },
    Image(ImageDescriptor),
    /// A source block whose shape is not understood by the adapter.
    Unsupported,
}

#[derive(Debug, Clone)]
pub(crate) enum ContentPart {
    Text(String),
    Image(ImageDescriptor),
    /// A source content part whose shape is not understood by the adapter.
    Unsupported,
}

#[derive(Debug, Clone)]
pub(crate) struct ImageDescriptor {
    pub media_type: Option<String>,
    /// Source `data` string length in encoded UTF-8 bytes (usually base64).
    /// No decoding or image retention is performed.
    pub encoded_data_length: Option<u64>,
}
