//! Turns the active branch into normalized model calls, context items and
//! compactions. Sections 5 to 7 of plans/archive/claude-code-implementation-plan.md
//! describe the rules.

use super::{records::Record, Limitation};
use crate::{
    domain::*,
    pi::reconstruct::{bounded_label, display_path_argument, first_nonempty_line},
};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

/// Attachment types that Claude Code 2.1.287 writes with their rendered text.
/// The same type without rendered text (as 2.1.229 writes) was probably sent,
/// but its text is not known.
const RENDERED_ATTACHMENT_TYPES: &[&str] = &[
    "agent_listing_delta",
    "auto_mode",
    "date",
    "deferred_tools_delta",
    "edited_text_file",
    "environment",
    "file",
    "instructions",
    "mcp_instructions_delta",
    "model",
    "plan_mode_exit",
    "queued_command",
    "remote_session_change",
    "session_context",
    "silent_turn_reminder",
    "skill_listing",
    "total_tokens_reminder",
];

pub(super) struct Reconstruction {
    pub session: NormalizedSession,
    pub limitations: BTreeSet<Limitation>,
}

struct PendingCompaction {
    before_model_call: usize,
    tokens_before: Option<u64>,
    source_item_ids: Vec<String>,
    retained_item_ids: Vec<String>,
    summary_item_id: Option<String>,
}

struct Response {
    item: Option<usize>,
    call: usize,
    model: Option<String>,
    has_thinking: bool,
}

struct State<'a> {
    records: &'a [Record],
    working_directory: Option<String>,
    items: Vec<NormalizedContextItem>,
    item_indexes: HashMap<String, usize>,
    active: Vec<usize>,
    calls: Vec<NormalizedModelCall>,
    responses: HashMap<String, Response>,
    compactions: Vec<PendingCompaction>,
    next_compaction: Option<String>,
    limitations: BTreeSet<Limitation>,
    tool_names: HashMap<String, (String, Value)>,
    failed_tools: HashSet<String>,
    /// The latest response, whose thinking item is added once its usage is final.
    open_response: Option<String>,
    /// Thinking items that leave the context at the next user message, for models
    /// that keep thinking only for the current turn.
    turn_thinking: Vec<usize>,
}

pub(super) fn reconstruct(
    records: &[Record],
    branch: &[usize],
    session_id: String,
) -> Result<Reconstruction, SourceError> {
    let on_branch = || branch.iter().map(|index| &records[*index]);
    let working_directory = on_branch()
        .find_map(|record| record.value.get("cwd").and_then(Value::as_str))
        .filter(|cwd| !cwd.is_empty())
        .map(str::to_owned);
    let version = on_branch()
        .find_map(|record| record.value.get("version").and_then(Value::as_str))
        .unwrap_or("unknown")
        .to_owned();
    let mut tool_names = HashMap::new();
    let mut failed_tools = HashSet::new();
    for record in on_branch() {
        for block in record.blocks() {
            match block.get("type").and_then(Value::as_str) {
                Some("tool_use") if record.kind() == "assistant" => {
                    if let Some(id) = block.get("id").and_then(Value::as_str) {
                        let name = block.get("name").and_then(Value::as_str).unwrap_or("");
                        let input = block.get("input").cloned().unwrap_or(Value::Null);
                        tool_names.insert(id.to_owned(), (name.to_owned(), input));
                    }
                }
                Some("tool_result")
                    if record.kind() == "user"
                        && block.get("is_error").and_then(Value::as_bool) == Some(true) =>
                {
                    if let Some(id) = block.get("tool_use_id").and_then(Value::as_str) {
                        failed_tools.insert(id.to_owned());
                    }
                }
                _ => {}
            }
        }
    }
    let mut state = State {
        records,
        working_directory,
        items: Vec::new(),
        item_indexes: HashMap::new(),
        active: Vec::new(),
        calls: Vec::new(),
        responses: HashMap::new(),
        compactions: Vec::new(),
        next_compaction: None,
        limitations: [
            Limitation::MissingHistoricalSystemPrompt,
            Limitation::MissingHistoricalToolDefinitions,
            Limitation::UnrecordedHarnessCalls,
        ]
        .into(),
        tool_names,
        failed_tools,
        open_response: None,
        turn_thinking: Vec::new(),
    };
    for index in branch {
        state.apply(&records[*index])?;
    }
    let working_directory = state.working_directory.clone();
    Ok(Reconstruction {
        limitations: std::mem::take(&mut state.limitations),
        session: state.finish(
            session_id,
            working_directory,
            SourceDescriptor {
                kind: "claude-code".into(),
                version,
                cost_basis: CostBasis::Unknown,
            },
        ),
    })
}

impl State<'_> {
    fn apply(&mut self, record: &Record) -> Result<(), SourceError> {
        match record.kind() {
            "assistant" => self.apply_assistant(record),
            "user" => {
                self.apply_user(record);
                Ok(())
            }
            "attachment" => {
                self.apply_attachment(record);
                Ok(())
            }
            "system" => {
                if record.is_compact_boundary() {
                    self.apply_boundary(record);
                }
                Ok(())
            }
            _ => {
                if record.uuid().is_some() {
                    self.limitations.insert(Limitation::UnsupportedContent);
                }
                Ok(())
            }
        }
    }

    fn insert(&mut self, item: NormalizedContextItem) -> usize {
        if let Some(index) = self.item_indexes.get(&item.id) {
            return *index;
        }
        let index = self.items.len();
        self.item_indexes.insert(item.id.clone(), index);
        self.items.push(item);
        self.active.push(index);
        index
    }

    fn apply_assistant(&mut self, record: &Record) -> Result<(), SourceError> {
        let Some(message_id) = record.message_id().map(str::to_owned) else {
            return Err(SourceError::RequiredField {
                field: "message.id",
            });
        };
        let message = record
            .message()
            .ok_or(SourceError::RequiredField { field: "message" })?;
        let usage = message.get("usage");
        let has_thinking = record
            .blocks()
            .iter()
            .any(|block| block.get("type").and_then(Value::as_str) == Some("thinking"));
        if let Some(response) = self.responses.get_mut(&message_id) {
            response.has_thinking |= has_thinking;
            let (call, item) = (response.call, response.item);
            let Some(item) = item else {
                // Later records of a failed attempt add nothing.
                return Ok(());
            };
            self.calls[call].reported_usage = reported_usage(usage)?;
            for block in record.blocks() {
                let converted = self.assistant_block(block);
                self.push_assistant_block(item, converted, record.source_bytes);
                self.add_tool_call(call, block);
            }
            return Ok(());
        }
        self.finish_response();
        let index = self.calls.len() + 1;
        let context_item_ids = self
            .active
            .iter()
            .map(|item| self.items[*item].id.clone())
            .collect();
        for item in &self.active {
            extend_presence(&mut self.items[*item], index);
        }
        let failed = record.flag("isApiErrorMessage");
        let model = message
            .get("model")
            .and_then(Value::as_str)
            .map(str::to_owned);
        self.calls.push(NormalizedModelCall {
            tool_loadout_known: false,
            index,
            source_record_id: message_id.clone(),
            target: ModelTarget {
                provider: Some("anthropic".into()),
                model: model.clone(),
                api: Some("anthropic-messages".into()),
            },
            reported_usage: if failed {
                placeholder_usage()
            } else {
                reported_usage(usage)?
            },
            stop_reason: message
                .get("stop_reason")
                .and_then(Value::as_str)
                .map(str::to_owned),
            timestamps: CallTimestamps {
                started_at_ms: None,
                recorded_at_ms: timestamp_ms(record),
            },
            context_item_ids,
            tool_calls_after: Vec::new(),
            compaction_before: self.next_compaction.take(),
        });
        let call = index - 1;
        if failed {
            // The error text is shown in the terminal by Claude Code; it is not
            // model output and is not sent with later requests.
            self.responses.insert(
                message_id,
                Response {
                    item: None,
                    call,
                    model,
                    has_thinking: false,
                },
            );
            return Ok(());
        }
        let blocks: Vec<AssistantContentBlock> = record
            .blocks()
            .iter()
            .map(|block| self.assistant_block(block))
            .collect();
        for block in record.blocks() {
            self.add_tool_call(call, block);
        }
        let item = self.insert(NormalizedContextItem {
            id: format!("claude-code:assistant:{message_id}"),
            kind: ContextItemKind::AssistantMessage,
            label: String::new(),
            source_record_id: record.uuid().map(str::to_owned),
            source_tool_call_id: None,
            metadata: BTreeMap::new(),
            serialized_size_bytes: record.source_bytes,
            payload: TokenizationPayload::AssistantMessage {
                blocks,
                source_provider: Some("anthropic".into()),
                source_model: model,
                source_api: Some("anthropic-messages".into()),
                thinking_reported: false,
            },
            presence: Vec::new(),
            first_model_call: 0,
            last_model_call: 0,
        });
        self.responses.insert(
            message_id.clone(),
            Response {
                item: Some(item),
                call,
                model: self.calls[call].target.model.clone(),
                has_thinking,
            },
        );
        self.open_response = Some(message_id);
        Ok(())
    }

    /// Anthropic sends a response's thinking back with later requests and bills it as
    /// input, rebuilding it from the signature whatever the transcript shows. Its size is
    /// the response's reported reasoning tokens, so it becomes its own item.
    fn finish_response(&mut self) {
        let Some(message_id) = self.open_response.take() else {
            return;
        };
        let Some(response) = self.responses.get(&message_id) else {
            return;
        };
        let (Some(item), true, Some(model)) =
            (response.item, response.has_thinking, response.model.clone())
        else {
            return;
        };
        let Some(keeps) = crate::analysis::claude_keeps_prior_thinking(&model) else {
            return;
        };
        let Some(tokens) = self.calls[response.call]
            .reported_usage
            .reasoning
            .filter(|tokens| *tokens > 0)
        else {
            return;
        };
        if let TokenizationPayload::AssistantMessage {
            thinking_reported, ..
        } = &mut self.items[item].payload
        {
            *thinking_reported = true;
        }
        let thinking = NormalizedContextItem::reported_thinking(
            format!("claude-code:thinking:{message_id}"),
            self.items[item].source_record_id.clone(),
            tokens,
            model,
        );
        let index = self.items.len();
        self.item_indexes.insert(thinking.id.clone(), index);
        self.items.push(thinking);
        // Thinking comes before the response's text and tool calls.
        if let Some(position) = self.active.iter().position(|active| *active == item) {
            self.active.insert(position, index);
            if !keeps {
                self.turn_thinking.push(index);
            }
        }
    }

    fn push_assistant_block(&mut self, item: usize, block: AssistantContentBlock, bytes: u64) {
        let item = &mut self.items[item];
        item.serialized_size_bytes = item.serialized_size_bytes.saturating_add(bytes);
        if let TokenizationPayload::AssistantMessage { blocks, .. } = &mut item.payload {
            blocks.push(block);
        }
    }

    fn add_tool_call(&mut self, call: usize, block: &Value) {
        if block.get("type").and_then(Value::as_str) != Some("tool_use") {
            return;
        }
        let Some(id) = block.get("id").and_then(Value::as_str) else {
            return;
        };
        let name = block.get("name").and_then(Value::as_str).unwrap_or("");
        self.calls[call].tool_calls_after.push(NormalizedToolCall {
            id: id.to_owned(),
            name: name.to_owned(),
            failed: self.failed_tools.contains(id),
        });
    }

    fn assistant_block(&mut self, block: &Value) -> AssistantContentBlock {
        let text = |key| {
            block
                .get(key)
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_owned()
        };
        match block.get("type").and_then(Value::as_str) {
            Some("text") => AssistantContentBlock::Text(text("text")),
            Some("thinking") => AssistantContentBlock::Thinking {
                text: text("thinking"),
                provider_signature: block
                    .get("signature")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
            },
            Some("tool_use") => AssistantContentBlock::ToolCall {
                id: text("id"),
                name: text("name"),
                arguments: block
                    .get("input")
                    .map(Value::to_string)
                    .unwrap_or_else(|| "{}".into()),
            },
            _ => {
                self.limitations.insert(Limitation::UnsupportedContent);
                AssistantContentBlock::Unsupported
            }
        }
    }

    fn apply_user(&mut self, record: &Record) {
        let Some(uuid) = record.uuid() else {
            return;
        };
        let content = record.message().and_then(|message| message.get("content"));
        let mut parts = Vec::new();
        match content {
            Some(Value::String(text)) => parts.push(ContentPart::Text(text.clone())),
            Some(Value::Array(blocks)) => {
                for block in blocks {
                    if block.get("type").and_then(Value::as_str) == Some("tool_result") {
                        self.apply_tool_result(record, block);
                    } else {
                        let part = self.content_part(block);
                        parts.push(part);
                    }
                }
            }
            _ => {}
        }
        if parts.is_empty() {
            return;
        }
        let content = MessageContent { parts };
        let first_line = content_first_line(&content);
        let (kind, key, label, payload) = if record.flag("isCompactSummary") {
            (
                ContextItemKind::CompactionSummary,
                "summary",
                "Compaction summary".to_owned(),
                TokenizationPayload::CompactionSummary(content_text(&content)),
            )
        } else if record.flag("isMeta") {
            (
                ContextItemKind::CustomMessage,
                "meta",
                tagged_label(first_line.as_deref(), "Context"),
                TokenizationPayload::CustomMessage(content),
            )
        } else {
            let label = if first_line.is_none() && has_image(&content) {
                "User · Image".to_owned()
            } else {
                tagged_label(first_line.as_deref(), "User")
            };
            (
                ContextItemKind::UserMessage,
                "user",
                label,
                TokenizationPayload::UserMessage(content),
            )
        };
        if kind == ContextItemKind::UserMessage {
            self.finish_response();
            let ending: HashSet<usize> = self.turn_thinking.drain(..).collect();
            self.active.retain(|item| !ending.contains(item));
        }
        let id = format!("claude-code:{key}:{uuid}");
        let item = NormalizedContextItem {
            id: id.clone(),
            kind,
            label,
            source_record_id: Some(uuid.to_owned()),
            source_tool_call_id: None,
            metadata: BTreeMap::new(),
            serialized_size_bytes: record.source_bytes,
            payload,
            presence: Vec::new(),
            first_model_call: 0,
            last_model_call: 0,
        };
        if kind == ContextItemKind::CompactionSummary {
            self.apply_summary(item);
        } else {
            self.insert(item);
        }
    }

    fn apply_tool_result(&mut self, record: &Record, block: &Value) {
        let Some(tool_call_id) = block.get("tool_use_id").and_then(Value::as_str) else {
            self.limitations.insert(Limitation::UnsupportedContent);
            return;
        };
        let parts = match block.get("content") {
            Some(Value::String(text)) => vec![ContentPart::Text(text.clone())],
            Some(Value::Array(blocks)) => {
                blocks.iter().map(|part| self.content_part(part)).collect()
            }
            _ => Vec::new(),
        };
        let is_error = block.get("is_error").and_then(Value::as_bool) == Some(true);
        let (tool_name, input) = self
            .tool_names
            .get(tool_call_id)
            .cloned()
            .unwrap_or_default();
        let mut metadata = BTreeMap::new();
        if !tool_name.is_empty() {
            metadata.insert("toolName".into(), tool_name.clone());
        }
        metadata.insert("isError".into(), is_error.to_string());
        let label = tool_result_label(&tool_name, &input, self.working_directory.as_deref());
        self.insert(NormalizedContextItem {
            id: format!("claude-code:tool:{tool_call_id}"),
            kind: ContextItemKind::ToolResult,
            label,
            source_record_id: record.uuid().map(str::to_owned),
            source_tool_call_id: Some(tool_call_id.to_owned()),
            metadata,
            serialized_size_bytes: record.source_bytes,
            payload: TokenizationPayload::ToolResult {
                tool_call_id: tool_call_id.to_owned(),
                tool_name,
                content: MessageContent { parts },
                is_error,
            },
            presence: Vec::new(),
            first_model_call: 0,
            last_model_call: 0,
        });
    }

    fn content_part(&mut self, block: &Value) -> ContentPart {
        match block.get("type").and_then(Value::as_str) {
            Some("text") => ContentPart::Text(
                block
                    .get("text")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_owned(),
            ),
            Some("image") => {
                let source = block.get("source");
                let field = |key| {
                    source
                        .and_then(|source| source.get(key))
                        .and_then(Value::as_str)
                };
                ContentPart::Image(ImageDescriptor::from_encoded(
                    field("media_type"),
                    field("data"),
                ))
            }
            Some("tool_reference") => ContentPart::ToolReference(
                block
                    .get("tool_name")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown")
                    .to_owned(),
            ),
            _ => {
                self.limitations.insert(Limitation::UnsupportedContent);
                ContentPart::Unsupported
            }
        }
    }

    fn apply_attachment(&mut self, record: &Record) {
        let Some(uuid) = record.uuid() else {
            return;
        };
        let attachment_type = record
            .value
            .get("attachment")
            .and_then(|attachment| attachment.get("type"))
            .and_then(Value::as_str)
            .unwrap_or("");
        let rendered = ["rendered", "renderedInHumanTurn"]
            .iter()
            .find_map(|key| record.value.get(*key).filter(|value| !value.is_null()));
        let Some(rendered) = rendered else {
            if RENDERED_ATTACHMENT_TYPES.contains(&attachment_type) {
                self.limitations.insert(Limitation::UnrenderedAttachments);
            }
            return;
        };
        let parts: Vec<ContentPart> = match rendered {
            Value::String(text) => vec![ContentPart::Text(text.clone())],
            Value::Array(entries) => entries
                .iter()
                .filter_map(|entry| {
                    entry
                        .get("content")
                        .and_then(Value::as_str)
                        .or_else(|| entry.as_str())
                        .map(|text| ContentPart::Text(text.to_owned()))
                })
                .collect(),
            _ => Vec::new(),
        };
        if parts.is_empty() {
            self.limitations.insert(Limitation::UnsupportedContent);
            return;
        }
        let mut metadata = BTreeMap::new();
        metadata.insert("attachmentType".into(), attachment_type.to_owned());
        if let Some(role) = record.value.get("renderedRole").and_then(Value::as_str) {
            metadata.insert("renderedRole".into(), role.to_owned());
        }
        self.insert(NormalizedContextItem {
            id: format!("claude-code:attachment:{uuid}"),
            kind: ContextItemKind::CustomMessage,
            label: attachment_label(attachment_type, record),
            source_record_id: Some(uuid.to_owned()),
            source_tool_call_id: None,
            metadata,
            serialized_size_bytes: record.source_bytes,
            payload: TokenizationPayload::CustomMessage(MessageContent { parts }),
            presence: Vec::new(),
            first_model_call: 0,
            last_model_call: 0,
        });
    }

    /// Items in `preservedSegment` stay; the rest end at the last call before
    /// the boundary.
    fn apply_boundary(&mut self, record: &Record) {
        self.finish_response();
        self.limitations.insert(Limitation::MissingCompactionUsage);
        let metadata = record.value.get("compactMetadata");
        let preserved = metadata.and_then(|metadata| {
            metadata
                .get("preservedSegment")
                .and_then(|segment| self.preserved_records(segment))
                .or_else(|| preserved_messages(metadata))
        });
        if preserved.is_none() {
            self.limitations
                .insert(Limitation::UnverifiedCompactionRetention);
        }
        let preserved = preserved.unwrap_or_default();
        let (retained, old): (Vec<usize>, Vec<usize>) = self.active.iter().partition(|item| {
            self.items[**item]
                .source_record_id
                .as_deref()
                .is_some_and(|uuid| preserved.contains(uuid))
        });
        let ids = |items: &[usize]| {
            items
                .iter()
                .map(|item| self.items[*item].id.clone())
                .collect::<Vec<_>>()
        };
        self.compactions.push(PendingCompaction {
            before_model_call: self.calls.len() + 1,
            tokens_before: metadata
                .and_then(|metadata| metadata.get("preTokens"))
                .and_then(Value::as_u64),
            source_item_ids: ids(&old),
            retained_item_ids: ids(&retained),
            summary_item_id: None,
        });
        self.active = retained;
    }

    /// The UUIDs from `tailUuid` back to `headUuid` along their original
    /// parents, or `None` when that walk does not reach the head.
    fn preserved_records(&self, segment: &Value) -> Option<HashSet<String>> {
        let head = segment.get("headUuid")?.as_str()?;
        let tail = segment.get("tailUuid")?.as_str()?;
        let by_uuid: HashMap<&str, &Record> = self
            .records
            .iter()
            .filter_map(|record| Some((record.uuid()?, record)))
            .collect();
        let mut preserved = HashSet::new();
        let mut current = Some(tail);
        while let Some(uuid) = current {
            if !preserved.insert(uuid.to_owned()) {
                return None;
            }
            if uuid == head {
                return Some(preserved);
            }
            current = by_uuid.get(uuid)?.parent();
        }
        None
    }

    fn apply_summary(&mut self, item: NormalizedContextItem) {
        let id = item.id.clone();
        let pending = self
            .compactions
            .last_mut()
            .filter(|pending| pending.summary_item_id.is_none());
        let Some(pending) = pending else {
            // A summary without a boundary is shown as an ordinary item.
            self.insert(item);
            return;
        };
        pending.summary_item_id = Some(id.clone());
        let index = self.insert(item);
        self.active.retain(|item| *item != index);
        self.active.insert(0, index);
        self.next_compaction = Some(id);
    }

    fn finish(
        self,
        id: String,
        working_directory: Option<String>,
        source: SourceDescriptor,
    ) -> NormalizedSession {
        let Self {
            mut items,
            calls,
            compactions,
            ..
        } = self;
        for item in &mut items {
            let lifetime = item.lifetime();
            item.first_model_call = lifetime.map_or(0, |lifetime| lifetime.first_call);
            item.last_model_call = lifetime.map_or(0, |lifetime| lifetime.last_call);
            if item.label.is_empty() {
                item.label = assistant_label(&item.payload);
            }
        }
        let visible: HashSet<String> = items
            .iter()
            .filter(|item| !item.presence.is_empty())
            .map(|item| item.id.clone())
            .collect();
        let mut lineage = Vec::new();
        let mut normalized_compactions = Vec::new();
        for compaction in compactions {
            let Some(summary) = compaction.summary_item_id else {
                continue;
            };
            if !visible.contains(&summary) {
                continue;
            }
            let sources: Vec<String> = compaction
                .source_item_ids
                .into_iter()
                .filter(|id| visible.contains(id))
                .collect();
            for source in &sources {
                lineage.push(NormalizedLineageEdge {
                    from: source.clone(),
                    to: summary.clone(),
                    kind: "frameworkCompaction".into(),
                });
            }
            normalized_compactions.push(NormalizedCompaction {
                id: summary.clone(),
                before_model_call: compaction.before_model_call,
                source_item_ids: sources,
                retained_item_ids: compaction
                    .retained_item_ids
                    .into_iter()
                    .filter(|id| visible.contains(id))
                    .collect(),
                summary_item_id: summary,
                tokens_before: compaction.tokens_before,
            });
        }
        let mut context_items: Vec<_> = items
            .into_iter()
            .filter(|item| visible.contains(&item.id))
            .collect();
        context_items.sort_by(|left, right| {
            left.first_model_call
                .cmp(&right.first_model_call)
                .then_with(|| left.id.cmp(&right.id))
        });
        lineage.sort_by(|left, right| {
            left.to
                .cmp(&right.to)
                .then_with(|| left.from.cmp(&right.from))
        });
        NormalizedSession {
            harness_session_cost: None,
            id,
            source,
            title: None,
            working_directory,
            context_items,
            model_calls: calls,
            compactions: normalized_compactions,
            lineage,
        }
    }
}

fn extend_presence(item: &mut NormalizedContextItem, call_index: usize) {
    if let Some(last) = item.presence.last_mut() {
        if last.end_call.checked_add(1) == Some(call_index) {
            last.end_call = call_index;
            return;
        }
    }
    item.presence.push(PresenceRange {
        start_call: call_index,
        end_call: call_index,
    });
}

fn timestamp_ms(record: &Record) -> Option<i64> {
    record
        .value
        .get("timestamp")
        .and_then(Value::as_str)
        .and_then(|timestamp| chrono::DateTime::parse_from_rfc3339(timestamp).ok())
        .map(|timestamp| timestamp.timestamp_millis())
}

fn counter(value: Option<&Value>, field: &'static str) -> Result<Option<u64>, SourceError> {
    match value.and_then(Value::as_u64) {
        Some(count) if count > MAX_SAFE_JSON_INTEGER => Err(SourceError::UnsafeInteger { field }),
        count => Ok(count),
    }
}

/// Anthropic counts thinking inside `output_tokens`; `thinking_tokens` is the
/// part of it spent on thinking.
fn reported_usage(usage: Option<&Value>) -> Result<ReportedUsage, SourceError> {
    let field = |path: &[&str]| {
        path.iter()
            .try_fold(usage?, |value, key| value.get(*key))
            .filter(|value| !value.is_null())
    };
    let output = counter(field(&["output_tokens"]), "usage.output_tokens")?;
    Ok(ReportedUsage {
        placeholder: None,
        input: counter(field(&["input_tokens"]), "usage.input_tokens")?,
        input_total: None,
        output,
        recorded_output: output,
        output_reasoning_relationship: OutputReasoningRelationship::IncludesReasoning,
        cache_read: counter(
            field(&["cache_read_input_tokens"]),
            "usage.cache_read_input_tokens",
        )?,
        cache_write: counter(
            field(&["cache_creation_input_tokens"]),
            "usage.cache_creation_input_tokens",
        )?,
        cache_write_1h: counter(
            field(&["cache_creation", "ephemeral_1h_input_tokens"]),
            "usage.cache_creation.ephemeral_1h_input_tokens",
        )?,
        reasoning: counter(
            field(&["output_tokens_details", "thinking_tokens"]),
            "usage.output_tokens_details.thinking_tokens",
        )?,
        total_tokens: None,
        cost: ReportedCost::default(),
    })
}

/// An API error record's counters are all written as zero; they are not a
/// measurement of anything.
fn placeholder_usage() -> ReportedUsage {
    ReportedUsage {
        placeholder: Some(PlaceholderUsage {
            cache_write_1h: None,
            reasoning: None,
            cost: ReportedCost::default(),
        }),
        ..ReportedUsage::default()
    }
}

fn content_text(content: &MessageContent) -> String {
    content
        .parts
        .iter()
        .filter_map(|part| match part {
            ContentPart::Text(text) => Some(text.as_str()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn content_first_line(content: &MessageContent) -> Option<String> {
    content.parts.iter().find_map(|part| match part {
        ContentPart::Text(text) => first_nonempty_line(text),
        _ => None,
    })
}

fn has_image(content: &MessageContent) -> bool {
    content
        .parts
        .iter()
        .any(|part| matches!(part, ContentPart::Image(_)))
}

/// Claude Code wraps commands, their output and reminders in XML-like tags.
/// The label names what the tag says instead of showing the markup.
fn tagged_label(first_line: Option<&str>, prefix: &str) -> String {
    let Some(line) = first_line else {
        return if prefix == "User" {
            "User message".into()
        } else {
            "Context message".into()
        };
    };
    let inner = |tag: &str| {
        let open = format!("<{tag}>");
        let close = format!("</{tag}>");
        line.strip_prefix(&open)
            .map(|rest| bounded_label(rest.split(close.as_str()).next().unwrap_or(rest)))
    };
    if let Some(command) = inner("command-name").filter(|command| !command.is_empty()) {
        return format!("Command · {command}");
    }
    for (tag, label) in [
        ("local-command-stdout", "Command output"),
        ("local-command-stderr", "Command output"),
        ("local-command-caveat", "Command caveat"),
        ("system-reminder", "System reminder"),
        ("task-notification", "Task notification"),
    ] {
        if line.starts_with(&format!("<{tag}>")) {
            return label.into();
        }
    }
    format!("{prefix} · {line}")
}

fn assistant_label(payload: &TokenizationPayload) -> String {
    let TokenizationPayload::AssistantMessage { blocks, .. } = payload else {
        return "Assistant response".into();
    };
    if let Some(line) = blocks.iter().find_map(|block| match block {
        AssistantContentBlock::Text(text) => first_nonempty_line(text),
        _ => None,
    }) {
        return format!("Assistant · {line}");
    }
    let names: Vec<String> = blocks
        .iter()
        .filter_map(|block| match block {
            AssistantContentBlock::ToolCall { name, .. } => {
                let name = bounded_label(name);
                Some(if name.is_empty() { "Tool".into() } else { name })
            }
            _ => None,
        })
        .collect();
    if names.is_empty() {
        return "Assistant response".into();
    }
    let shown = names.iter().take(3).cloned().collect::<Vec<_>>().join(", ");
    if names.len() > 3 {
        format!("Assistant · {shown}, +{} more", names.len() - 3)
    } else {
        format!("Assistant · {shown}")
    }
}

/// Labels for Claude Code's built-in file, shell and search tools. Other tools
/// keep a generic label rather than guessing what their arguments mean.
fn tool_result_label(name: &str, input: &Value, working_directory: Option<&str>) -> String {
    let argument = |key: &str| {
        input
            .get(key)
            .and_then(Value::as_str)
            .map(bounded_label)
            .filter(|text| !text.is_empty())
    };
    let detail = match name {
        "Read" | "Write" | "Edit" | "NotebookEdit" => input
            .get("file_path")
            .or_else(|| input.get("notebook_path"))
            .and_then(Value::as_str)
            .map(|path| bounded_label(&display_path_argument(path, working_directory)))
            .filter(|text| !text.is_empty()),
        "Bash" => argument("command"),
        "Grep" | "Glob" => argument("pattern"),
        _ => None,
    };
    let name = bounded_label(name);
    match (name.is_empty(), detail) {
        (true, _) => "Tool result".into(),
        (false, Some(detail)) => format!("{name} result · {detail}"),
        (false, None) => format!("{name} result"),
    }
}

fn attachment_label(attachment_type: &str, record: &Record) -> String {
    let name = match attachment_type {
        "environment" => "Environment",
        "date" => "Date",
        "model" => "Model",
        "instructions" => "Instructions",
        "session_context" => "Session context",
        "total_tokens_reminder" => "Token reminder",
        "silent_turn_reminder" => "Turn reminder",
        "skill_listing" => "Skill listing",
        "agent_listing_delta" => "Agent listing",
        "deferred_tools_delta" => "Deferred tools",
        "mcp_instructions_delta" => "MCP instructions",
        "queued_command" => "Queued notification",
        "plan_mode_exit" => "Plan mode",
        "auto_mode" => "Auto mode",
        "remote_session_change" => "Remote session",
        "edited_text_file" | "file" => {
            let file = record
                .value
                .get("attachment")
                .and_then(|attachment| attachment.get("filename"))
                .and_then(Value::as_str)
                .and_then(|path| std::path::Path::new(path).file_name())
                .and_then(|name| name.to_str())
                .map(bounded_label)
                .filter(|name| !name.is_empty());
            let prefix = if attachment_type == "file" {
                "File"
            } else {
                "Edited file"
            };
            return file.map_or_else(|| prefix.into(), |file| format!("{prefix} · {file}"));
        }
        other => {
            let other = bounded_label(other);
            return if other.is_empty() {
                "Attachment".into()
            } else {
                format!("Attachment · {other}")
            };
        }
    };
    name.into()
}

/// The records Claude Code lists in `preservedMessages`, for a segment whose parent links
/// do not lead from its tail to its head (a tail written after the boundary).
fn preserved_messages(metadata: &Value) -> Option<HashSet<String>> {
    let uuids = metadata
        .get("preservedMessages")?
        .get("uuids")?
        .as_array()?;
    uuids
        .iter()
        .map(|uuid| {
            uuid.as_str()
                .filter(|uuid| !uuid.is_empty())
                .map(str::to_owned)
        })
        .collect()
}
