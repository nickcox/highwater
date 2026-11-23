//! Source-neutral records. An item's lifetime is derived from its presence.

#[cfg(test)]
mod tests;

use super::{source::CostBasis, Harness};
use std::collections::{BTreeMap, HashSet};

/// Largest integer that can be represented exactly by the TypeScript/JSON contract.
pub(crate) const MAX_SAFE_JSON_INTEGER: u64 = 9_007_199_254_740_991;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SourceDescriptor {
    pub kind: Harness,
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
    pub turns: Vec<RecordedTurn>,
}

impl NormalizedSession {
    /// The last step of every reader except OpenCode: keep the items some call read and
    /// every compaction's summary, then build lineage from the sources that remain. A summary
    /// that no call read is kept because its compaction's own call still cost something.
    pub(crate) fn finish_reconstruction(mut self) -> Self {
        let summaries: HashSet<&str> = self
            .compactions
            .iter()
            .map(|compaction| compaction.summary_item_id.as_str())
            .collect();
        self.context_items
            .retain(|item| !item.presence.is_empty() || summaries.contains(item.id.as_str()));
        let shown: HashSet<&str> = self
            .context_items
            .iter()
            .map(|item| item.id.as_str())
            .collect();
        self.compactions
            .retain(|compaction| shown.contains(compaction.summary_item_id.as_str()));
        for compaction in &mut self.compactions {
            compaction
                .source_item_ids
                .retain(|id| shown.contains(id.as_str()));
            compaction
                .retained_item_ids
                .retain(|id| shown.contains(id.as_str()));
        }
        self.lineage = self
            .compactions
            .iter()
            .flat_map(|compaction| {
                compaction
                    .source_item_ids
                    .iter()
                    .map(|source| NormalizedLineageEdge {
                        from: source.clone(),
                        to: compaction.summary_item_id.clone(),
                        kind: "frameworkCompaction".into(),
                    })
            })
            .collect();
        let shown_compactions: HashSet<&str> = self
            .compactions
            .iter()
            .map(|compaction| compaction.id.as_str())
            .collect();
        for call in &mut self.model_calls {
            if call
                .compaction_before
                .as_deref()
                .is_some_and(|id| !shown_compactions.contains(id))
            {
                call.compaction_before = None;
            }
        }
        let first_call = |item: &NormalizedContextItem| {
            item.lifetime().map_or(0, |lifetime| lifetime.first_call)
        };
        self.context_items.sort_by(|left, right| {
            first_call(left)
                .cmp(&first_call(right))
                .then_with(|| left.id.cmp(&right.id))
        });
        self.compactions.sort_by(|left, right| {
            left.before_model_call
                .cmp(&right.before_model_call)
                .then_with(|| left.id.cmp(&right.id))
        });
        self.lineage.sort_by(|left, right| {
            left.to
                .cmp(&right.to)
                .then_with(|| left.from.cmp(&right.from))
                .then_with(|| left.kind.cmp(&right.kind))
        });
        self
    }
}

/// An identified user request and its inclusive range of projected calls.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecordedTurn {
    pub first_call: usize,
    pub last_call: usize,
    pub prompt: Option<String>,
    pub duration_ms: Option<u64>,
    pub status: Option<TurnStatus>,
    /// The source combined multiple model calls into one projected call.
    pub combined_calls: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum TurnStatus {
    Completed,
    Failed,
    Interrupted,
}

pub(crate) fn turn_duration_ms(value: u64) -> Option<u64> {
    (value <= MAX_SAFE_JSON_INTEGER).then_some(value)
}

/// A session total the harness calculated itself, such as Claude Code's `cost-state`.
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
    /// The harness recorded the call as a retry after an error (VS Code Copilot's
    /// `retry-error-panel/editAgent` trace records).
    pub retried: bool,
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
    /// The total input, including any cached part, when the source reports only the total
    /// (a VS Code Copilot session file). `input` and the cache counters are then unknown.
    pub input_total: Option<u64>,
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
    pub action: Option<ToolAction>,
}

/// What a tool call does, for the tools a reader knows. Other tools have none.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ToolAction {
    /// Runs a shell command; the command as recorded.
    Shell { command: String },
    /// Reads a file; the path as recorded.
    ReadFile { path: String },
    /// Writes or edits a file; the path as recorded.
    EditFile { path: String },
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
        }
    }

    /// What a compaction's own call read: the conversation as the harness sent it to be
    /// summarised, and its summarising prompt. Neither is recorded, so the item is sized by
    /// the call's reported input, or has no size when that is not reported.
    pub(crate) fn compaction_input(
        id: String,
        source_record_id: Option<String>,
        usage: &ReportedUsage,
    ) -> Self {
        let tokens = usage.input.map(|input| {
            input
                .saturating_add(usage.cache_read.unwrap_or(0))
                .saturating_add(usage.cache_write.unwrap_or(0))
        });
        Self {
            id,
            kind: ContextItemKind::UnrecordedContext,
            label: "Compaction input · not recorded".into(),
            source_record_id,
            source_tool_call_id: None,
            metadata: BTreeMap::from([("compactionInput".into(), "true".into())]),
            serialized_size_bytes: 0,
            payload: match tokens {
                Some(tokens) => TokenizationPayload::UnrecordedContext {
                    tokens,
                    approximate: false,
                },
                None => TokenizationPayload::Unavailable,
            },
            presence: Vec::new(),
        }
    }

    pub(crate) fn extend_presence(&mut self, call_index: usize) {
        if let Some(last) = self.presence.last_mut() {
            if last.end_call.checked_add(1) == Some(call_index) {
                last.end_call = call_index;
                return;
            }
        }
        self.presence.push(PresenceRange {
            start_call: call_index,
            end_call: call_index,
        });
    }

    /// The first and last calls in the item's presence, if it has any.
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
pub(crate) fn grouped(value: u64) -> String {
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
    /// Request content the source does not record, measured from reported usage.
    UnrecordedContext,
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
            Self::UnrecordedContext => "unrecordedContext",
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
    /// What the harness recorded about the compaction beyond what it removed and kept.
    pub details: CompactionDetails,
}

/// What started a compaction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CompactionTrigger {
    Automatic,
    Manual,
}

impl CompactionTrigger {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Automatic => "automatic",
            Self::Manual => "manual",
        }
    }
}

/// How a harness decides what a compaction keeps.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CompactionRule {
    /// Pi: the entries from `firstKeptEntryId` onwards.
    KeptFromEntry,
    /// OpenCode: the summary and the recent exchange saved with it.
    RecentExchange,
    /// Claude Code: the recorded preserved segment.
    PreservedSegment,
    /// Only the summary is kept.
    SummaryOnly,
    /// Codex: the recorded replacement history.
    ReplacementHistory,
    /// Copilot: the last messages from when the compaction started, and those added while
    /// it ran.
    KeptLastMessages,
    /// VS Code Copilot: inferred from the next call's input.
    InferredFromInput,
}

impl CompactionRule {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::KeptFromEntry => "keptFromEntry",
            Self::RecentExchange => "recentExchange",
            Self::PreservedSegment => "preservedSegment",
            Self::SummaryOnly => "summaryOnly",
            Self::ReplacementHistory => "replacementHistory",
            Self::KeptLastMessages => "keptLastMessages",
            Self::InferredFromInput => "inferredFromInput",
        }
    }
}

/// Optional facts about a compaction. Each source fills in what it records; the message
/// and token figures are the harness's own counts, not Highwater's estimates.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct CompactionDetails {
    pub trigger: Option<CompactionTrigger>,
    /// A manual compaction's focus text.
    pub instructions: Option<String>,
    pub rule: Option<CompactionRule>,
    /// For a compaction that ran in the background: the first call made after it started.
    pub started_before_model_call: Option<usize>,
    /// The compaction's own model call.
    pub summary_call: Option<usize>,
    pub duration_ms: Option<u64>,
    pub messages_before: Option<u64>,
    pub messages_removed: Option<u64>,
    pub messages_kept: Option<u64>,
    /// Messages added while a background compaction ran, which it also kept.
    pub messages_added_while_running: Option<u64>,
    pub tokens_after: Option<u64>,
    pub system_tokens_after: Option<u64>,
    pub tool_definition_tokens_after: Option<u64>,
    pub conversation_tokens_after: Option<u64>,
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
    /// Request content the source does not record (the system prompt and tool definitions,
    /// for example), sized as a call's reported input less the estimates of its recorded
    /// items. `approximate` when one of those estimates was partial.
    UnrecordedContext {
        tokens: u64,
        approximate: bool,
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
    /// A reference that loads a tool's definition into the request (Claude Code's
    /// `tool_reference`); the definition itself is not recorded.
    ToolReference(String),
    /// A source content part whose shape is not understood by the adapter.
    Unsupported,
}

#[derive(Debug, Clone)]
pub(crate) struct ImageDescriptor {
    pub media_type: Option<String>,
    /// Source `data` string length in encoded UTF-8 bytes (usually base64).
    /// The image is not decoded or kept.
    pub encoded_data_length: Option<u64>,
    /// `(width, height)` in pixels, read from the image's header.
    pub dimensions: Option<(u32, u32)>,
}

impl ImageDescriptor {
    /// From a media type and the base64 `data` the source recorded, if any.
    pub(crate) fn from_encoded(media_type: Option<&str>, data: Option<&str>) -> Self {
        Self {
            media_type: media_type.map(str::to_owned),
            encoded_data_length: data.map(|data| u64::try_from(data.len()).unwrap_or(u64::MAX)),
            dimensions: data.and_then(super::image::dimensions),
        }
    }
}
