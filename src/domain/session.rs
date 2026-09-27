use super::source::CostBasis;
use std::collections::BTreeMap;

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
}

#[derive(Debug, Clone)]
pub(crate) struct NormalizedModelCall {
    pub index: usize,
    pub source_record_id: String,
    pub target: ModelTarget,
    pub reported_usage: ReportedUsage,
    pub stop_reason: Option<String>,
    pub context_item_ids: Vec<String>,
    pub tool_calls_after: Vec<NormalizedToolCall>,
    pub compaction_before: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub(crate) struct ModelTarget {
    pub provider: Option<String>,
    pub model: Option<String>,
    pub api: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub(crate) struct ReportedUsage {
    pub input: Option<u64>,
    pub output: Option<u64>,
    pub cache_read: Option<u64>,
    pub cache_write: Option<u64>,
    pub cache_write_1h: Option<u64>,
    pub reasoning: Option<u64>,
    pub total_tokens: Option<u64>,
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
    /// Source-provided serialized size retained as a diagnostic, not a token weight.
    pub serialized_size: u64,
    pub payload: TokenizationPayload,
    pub presence: Vec<PresenceRange>,
    pub first_model_call: usize,
    pub last_model_call: usize,
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
    /// Return the inclusive number of calls covered by this range.
    pub(crate) fn call_count(&self) -> usize {
        self.end_call
            .saturating_sub(self.start_call)
            .saturating_add(1)
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
    },
    ToolResult {
        tool_call_id: String,
        tool_name: String,
        content: MessageContent,
        is_error: bool,
    },
    CustomMessage(MessageContent),
    CompactionSummary(String),
    BranchSummary(String),
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
    pub byte_length: Option<u64>,
}
