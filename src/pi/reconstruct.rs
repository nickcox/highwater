use super::parser::{parse_reader, PiEntry};
use crate::domain::*;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    io::BufRead,
};

#[derive(Debug, Default, Clone, Copy)]
pub(crate) struct PiSourceAdapter;

#[derive(Debug, Clone, Copy)]
pub(crate) struct PiParseStats {
    pub entries: usize,
    pub selected_entries: usize,
}

#[derive(Debug, Clone, Copy, Eq, Hash, PartialEq)]
struct ItemIndex(usize);

fn insert_item(
    items: &mut HashMap<String, NormalizedContextItem>,
    item_indices: &mut HashMap<String, ItemIndex>,
    item_ids: &mut Vec<String>,
    item_id: String,
    item: NormalizedContextItem,
) -> ItemIndex {
    if let Some(index) = item_indices.get(&item_id).copied() {
        return index;
    }
    let index = ItemIndex(item_ids.len());
    item_indices.insert(item_id.clone(), index);
    item_ids.push(item_id.clone());
    items.insert(item_id, item);
    index
}

impl SessionSourceAdapter for PiSourceAdapter {
    fn source_descriptor(&self) -> SourceDescriptor {
        SourceDescriptor {
            kind: "pi".into(),
            version: "jsonl-v1".into(),
        }
    }

    fn parse(&self, input: &mut dyn BufRead) -> Result<NormalizedSession, SourceError> {
        let entries = parse_reader(input).map_err(|error| SourceError::Parse(error.to_string()))?;
        let selected = select_branch(&entries)?;
        reconstruct_selected(&entries, self.source_descriptor(), selected)
    }
}

impl PiSourceAdapter {
    pub(crate) fn parse_path_with_stats(
        &self,
        path: &std::path::Path,
    ) -> Result<(NormalizedSession, PiParseStats), SourceError> {
        let file = std::fs::File::open(path)
            .map_err(|error| SourceError::Parse(format!("cannot read session: {error}")))?;
        let mut reader = std::io::BufReader::new(file);
        let entries =
            parse_reader(&mut reader).map_err(|error| SourceError::Parse(error.to_string()))?;
        let selected = select_branch(&entries)?;
        let selected_entries = selected.len();
        let session = reconstruct_selected(&entries, self.source_descriptor(), selected)?;
        Ok((
            session,
            PiParseStats {
                entries: entries.len(),
                selected_entries,
            },
        ))
    }
}

fn reconstruct_selected(
    entries: &[PiEntry],
    source: SourceDescriptor,
    selected: Vec<usize>,
) -> Result<NormalizedSession, SourceError> {
    let header = entries.iter().find(|entry| entry.kind == "session");
    let id = header
        .and_then(|entry| entry.value.get("id"))
        .and_then(Value::as_str)
        .or_else(|| selected.first().map(|index| entries[*index].id.as_str()))
        .unwrap_or("session")
        .to_owned();
    let working_directory = header
        .and_then(|entry| entry.value.get("cwd"))
        .and_then(Value::as_str)
        .map(str::to_owned);

    let mut items: HashMap<String, NormalizedContextItem> = HashMap::new();
    let mut item_indices = HashMap::<String, ItemIndex>::new();
    let mut item_ids = Vec::<String>::new();
    let mut calls = Vec::new();
    let mut active = Vec::<ItemIndex>::new();
    let mut compactions = Vec::<(String, Vec<String>, Vec<String>, usize, Option<u64>)>::new();
    let failed_tool_call_ids: HashSet<String> = selected
        .iter()
        .filter_map(|index| {
            let entry = &entries[*index];
            let message = message(entry)?;
            (message.get("role").and_then(Value::as_str) == Some("toolResult")
                && message.get("isError").and_then(Value::as_bool) == Some(true))
            .then(|| message.get("toolCallId").and_then(Value::as_str))
            .flatten()
            .map(str::to_owned)
        })
        .collect();
    let branch_positions: HashMap<&str, usize> = selected
        .iter()
        .enumerate()
        .map(|(index, entry_index)| (entries[*entry_index].id.as_str(), index))
        .collect();
    let mut last_compaction = None;

    for entry_index in &selected {
        let entry = &entries[*entry_index];
        if entry.kind == "compaction" {
            let summary_id = format!("pi:{id}:compaction:{}", entry.id);
            let summary = entry
                .value
                .get("summary")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_owned();
            let summary_index = insert_item(
                &mut items,
                &mut item_indices,
                &mut item_ids,
                summary_id.clone(),
                NormalizedContextItem {
                    id: summary_id.clone(),
                    kind: ContextItemKind::CompactionSummary,
                    label: "Compaction summary".into(),
                    source_record_id: Some(entry.id.clone()),
                    source_tool_call_id: None,
                    metadata: BTreeMap::new(),
                    serialized_size: entry.source_bytes,
                    payload: TokenizationPayload::CompactionSummary(summary),
                    presence: Vec::new(),
                    first_model_call: 0,
                    last_model_call: 0,
                },
            );
            let first_kept = entry.value.get("firstKeptEntryId").and_then(Value::as_str);
            let first_kept_position = first_kept.and_then(|key| branch_positions.get(key).copied());
            if first_kept.is_some() && first_kept_position.is_none() {
                return Err(SourceError::Invalid(format!(
                    "compaction {} references unknown firstKeptEntryId {}",
                    entry.id,
                    first_kept.unwrap_or_default()
                )));
            }
            let (old_indexes, retained_indexes): (Vec<ItemIndex>, Vec<ItemIndex>) =
                active.iter().copied().partition(|item_index| {
                    let item_id = &item_ids[item_index.0];
                    let Some(boundary) = first_kept_position else {
                        return true;
                    };
                    items
                        .get(item_id)
                        .and_then(|item| item.source_record_id.as_deref())
                        .and_then(|record_id| branch_positions.get(record_id).copied())
                        .is_none_or(|position| position < boundary)
                });
            let old = old_indexes
                .iter()
                .map(|item_index| item_ids[item_index.0].clone())
                .collect::<Vec<_>>();
            let retained = retained_indexes
                .iter()
                .map(|item_index| item_ids[item_index.0].clone())
                .collect::<Vec<_>>();
            active.clear();
            active.push(summary_index);
            active.extend(retained_indexes);
            last_compaction = Some(summary_id);
            compactions.push((
                entry.id.clone(),
                old,
                retained,
                calls.len() + 1,
                entry.value.get("tokensBefore").and_then(Value::as_u64),
            ));
            continue;
        }
        if !matches!(
            entry.kind.as_str(),
            "message" | "custom_message" | "branch_summary"
        ) {
            continue;
        }
        let role = message(entry)
            .and_then(|message| message.get("role"))
            .and_then(Value::as_str)
            .unwrap_or(match entry.kind.as_str() {
                "custom_message" => "customMessage",
                "branch_summary" => "branchSummary",
                other => other,
            });
        if role == "assistant" {
            let index = calls.len() + 1;
            let context_item_ids = active
                .iter()
                .map(|item_index| item_ids[item_index.0].clone())
                .collect::<Vec<_>>();
            for item_index in &active {
                let item_id = &item_ids[item_index.0];
                if let Some(item) = items.get_mut(item_id) {
                    item.last_model_call = index;
                    extend_presence(item, index);
                    if item.first_model_call == 0 {
                        item.first_model_call = index;
                    }
                }
            }
            let model_message = message(entry)
                .ok_or_else(|| SourceError::Invalid("assistant message is missing".into()))?;
            let usage = parse_usage(model_message.get("usage"));
            let stop_reason = model_message
                .get("stopReason")
                .and_then(Value::as_str)
                .map(str::to_owned);
            let tool_calls_after = assistant_tool_calls(model_message, &failed_tool_call_ids);
            calls.push(NormalizedModelCall {
                index,
                source_record_id: entry.id.clone(),
                target: ModelTarget {
                    provider: model_message
                        .get("provider")
                        .and_then(Value::as_str)
                        .map(str::to_owned),
                    model: model_message
                        .get("model")
                        .and_then(Value::as_str)
                        .map(str::to_owned),
                    api: model_message
                        .get("api")
                        .and_then(Value::as_str)
                        .map(str::to_owned),
                },
                reported_usage: usage,
                stop_reason: stop_reason.clone(),
                context_item_ids,
                tool_calls_after,
                compaction_before: last_compaction.take(),
            });
            let assistant_id = format!("pi:{id}:entry:{}", entry.id);
            let assistant_index = insert_item(
                &mut items,
                &mut item_indices,
                &mut item_ids,
                assistant_id.clone(),
                NormalizedContextItem {
                    id: assistant_id,
                    kind: ContextItemKind::AssistantMessage,
                    label: "Assistant response".into(),
                    source_record_id: Some(entry.id.clone()),
                    source_tool_call_id: None,
                    metadata: BTreeMap::new(),
                    serialized_size: entry.source_bytes,
                    payload: if has_content(model_message) {
                        TokenizationPayload::AssistantMessage {
                            blocks: assistant_blocks(model_message),
                            source_provider: model_message
                                .get("provider")
                                .and_then(Value::as_str)
                                .map(str::to_owned),
                            source_model: model_message
                                .get("model")
                                .and_then(Value::as_str)
                                .map(str::to_owned),
                            source_api: model_message
                                .get("api")
                                .and_then(Value::as_str)
                                .map(str::to_owned),
                        }
                    } else {
                        TokenizationPayload::Unavailable
                    },
                    presence: Vec::new(),
                    first_model_call: 0,
                    last_model_call: 0,
                },
            );
            if assistant_response_is_contextual(stop_reason.as_deref()) {
                active.push(assistant_index);
            }
            continue;
        }

        let item_id = format!("pi:{id}:entry:{}", entry.id);
        let item_kind = match role {
            "system" => ContextItemKind::System,
            "tool" | "toolResult" => ContextItemKind::ToolResult,
            "toolDefinition" => ContextItemKind::ToolDefinition,
            "user" => ContextItemKind::UserMessage,
            "custom_message" | "customMessage" => ContextItemKind::CustomMessage,
            "branch_summary" | "branchSummary" => ContextItemKind::BranchSummary,
            _ => ContextItemKind::Other,
        };
        let message_value = message(entry);
        let content_value = message_value.unwrap_or(&entry.value);
        let mut metadata = BTreeMap::new();
        if let Some(name) = content_value.get("toolName").and_then(Value::as_str) {
            metadata.insert("toolName".into(), name.into());
        }
        if let Some(is_error) = content_value.get("isError").and_then(Value::as_bool) {
            metadata.insert("isError".into(), is_error.to_string());
        }
        let payload = match item_kind {
            ContextItemKind::ToolResult => {
                if !has_content(content_value) {
                    TokenizationPayload::Unavailable
                } else {
                    TokenizationPayload::ToolResult {
                        tool_call_id: content_value
                            .get("toolCallId")
                            .and_then(Value::as_str)
                            .unwrap_or("")
                            .into(),
                        tool_name: content_value
                            .get("toolName")
                            .and_then(Value::as_str)
                            .unwrap_or("unknown")
                            .into(),
                        content: message_content(Some(content_value)),
                        is_error: content_value
                            .get("isError")
                            .and_then(Value::as_bool)
                            .unwrap_or(false),
                    }
                }
            }
            ContextItemKind::UserMessage => {
                if !has_content(content_value) {
                    TokenizationPayload::Unavailable
                } else {
                    TokenizationPayload::UserMessage(message_content(Some(content_value)))
                }
            }
            ContextItemKind::CustomMessage
            | ContextItemKind::System
            | ContextItemKind::ToolDefinition => {
                if !has_content(content_value) {
                    TokenizationPayload::Unavailable
                } else {
                    TokenizationPayload::CustomMessage(message_content(Some(content_value)))
                }
            }
            ContextItemKind::BranchSummary => entry
                .value
                .get("summary")
                .and_then(Value::as_str)
                .map_or(TokenizationPayload::Unavailable, |summary| {
                    TokenizationPayload::BranchSummary(summary.to_owned())
                }),
            ContextItemKind::Other if entry.kind == "command" => {
                match (
                    entry.value.get("command").and_then(Value::as_str),
                    entry.value.get("output").and_then(Value::as_str),
                ) {
                    (Some(command), Some(output)) => TokenizationPayload::CommandExecution {
                        command: command.into(),
                        output: output.into(),
                        excluded_from_context: entry
                            .value
                            .get("excludedFromContext")
                            .and_then(Value::as_bool)
                            .unwrap_or(false),
                    },
                    _ => TokenizationPayload::Unavailable,
                }
            }
            _ => TokenizationPayload::Unavailable,
        };
        let item_index = insert_item(
            &mut items,
            &mut item_indices,
            &mut item_ids,
            item_id.clone(),
            NormalizedContextItem {
                id: item_id,
                kind: item_kind,
                label: item_label(item_kind, message_value),
                source_record_id: Some(entry.id.clone()),
                source_tool_call_id: content_value
                    .get("toolCallId")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
                metadata,
                serialized_size: entry.source_bytes,
                payload,
                presence: Vec::new(),
                first_model_call: 0,
                last_model_call: 0,
            },
        );
        active.push(item_index);
    }

    for item in items.values_mut() {
        if item.first_model_call == 0 {
            item.presence.clear();
        } else if let Some(last) = item.presence.last() {
            item.last_model_call = last.end_call;
        }
    }

    let mut lineage = Vec::new();
    let mut compaction_dtos = Vec::new();
    for (compaction_id, old, retained, before_model_call, tokens_before) in compactions {
        let summary_id = format!("pi:{id}:compaction:{compaction_id}");
        for old_id in &old {
            lineage.push(NormalizedLineageEdge {
                from: old_id.clone(),
                to: summary_id.clone(),
                kind: "frameworkCompaction".into(),
            });
        }
        compaction_dtos.push(NormalizedCompaction {
            id: summary_id.clone(),
            before_model_call,
            source_item_ids: old,
            retained_item_ids: retained,
            summary_item_id: summary_id,
            tokens_before,
        });
    }
    let terminal_boundary = calls.len() + 1;
    let terminal_summary_ids: HashSet<String> = compaction_dtos
        .iter()
        .filter(|event| event.before_model_call == terminal_boundary)
        .map(|event| event.summary_item_id.clone())
        .collect();
    let mut context_items: Vec<_> = items
        .into_values()
        .filter(|item| !item.presence.is_empty() || terminal_summary_ids.contains(&item.id))
        .collect();
    let visible_ids: HashSet<String> = context_items.iter().map(|item| item.id.clone()).collect();
    compaction_dtos.retain(|event| visible_ids.contains(&event.summary_item_id));
    for event in &mut compaction_dtos {
        event
            .source_item_ids
            .retain(|item_id| visible_ids.contains(item_id));
        event
            .retained_item_ids
            .retain(|item_id| visible_ids.contains(item_id));
    }
    lineage.retain(|edge| visible_ids.contains(&edge.from) && visible_ids.contains(&edge.to));
    context_items.sort_by(|left, right| {
        left.first_model_call
            .cmp(&right.first_model_call)
            .then_with(|| left.id.cmp(&right.id))
    });
    compaction_dtos.sort_by(|left, right| {
        left.before_model_call
            .cmp(&right.before_model_call)
            .then_with(|| left.id.cmp(&right.id))
    });
    lineage.sort_by(|left, right| {
        left.to
            .cmp(&right.to)
            .then_with(|| left.from.cmp(&right.from))
            .then_with(|| left.kind.cmp(&right.kind))
    });

    Ok(NormalizedSession {
        id,
        source,
        title: None,
        working_directory,
        context_items,
        model_calls: calls,
        compactions: compaction_dtos,
        lineage,
    })
}

fn select_branch(entries: &[PiEntry]) -> Result<Vec<usize>, SourceError> {
    let mut map = HashMap::with_capacity(entries.len());
    for (index, entry) in entries
        .iter()
        .enumerate()
        .filter(|(_, entry)| entry.kind != "session")
    {
        if map.insert(entry.id.as_str(), index).is_some() {
            return Err(SourceError::Invalid(format!(
                "duplicate entry id {}",
                entry.id
            )));
        }
    }
    let mut complete = HashSet::new();
    for start in map.keys() {
        let mut path = HashSet::new();
        let mut current = Some(*start);
        while let Some(id) = current {
            if complete.contains(id) {
                break;
            }
            if !path.insert(id) {
                return Err(SourceError::Invalid(format!(
                    "cycle detected in parent graph at {id}"
                )));
            }
            let entry_index = map.get(id).copied().ok_or_else(|| {
                SourceError::Invalid(format!("broken parent link: missing entry {id}"))
            })?;
            current = entries[entry_index].parent.as_deref();
        }
        complete.extend(path);
    }
    let mut parents_with_children = HashSet::new();
    for entry in entries.iter().filter(|entry| entry.kind != "session") {
        if let Some(parent) = entry.parent.as_deref() {
            parents_with_children.insert(parent);
        }
    }
    let leaf_index = entries
        .iter()
        .enumerate()
        .rev()
        .find(|(_, entry)| {
            entry.kind != "session" && !parents_with_children.contains(entry.id.as_str())
        })
        .map(|(index, _)| index)
        .ok_or_else(|| SourceError::Invalid("session has no branch leaf".into()))?;
    let mut chain = Vec::new();
    let mut visited = HashSet::new();
    let mut current = Some(leaf_index);
    while let Some(index) = current {
        let entry = &entries[index];
        if !visited.insert(entry.id.as_str()) {
            return Err(SourceError::Invalid(format!(
                "cycle detected while following parent chain at {}",
                entry.id
            )));
        }
        chain.push(index);
        current = entry
            .parent
            .as_deref()
            .map(|parent| {
                map.get(parent).copied().ok_or_else(|| {
                    SourceError::Invalid(format!("broken parent link: missing entry {parent}"))
                })
            })
            .transpose()?;
    }
    chain.reverse();
    Ok(chain)
}

fn message(entry: &PiEntry) -> Option<&Value> {
    entry.value.get("message")
}

fn has_content(value: &Value) -> bool {
    value
        .get("content")
        .is_some_and(|content| content.is_string() || content.is_array())
}

fn item_label(kind: ContextItemKind, message: Option<&Value>) -> String {
    match kind {
        ContextItemKind::UserMessage => "User message".into(),
        ContextItemKind::AssistantMessage => "Assistant response".into(),
        ContextItemKind::ToolResult => format!(
            "Tool result · {}",
            message
                .and_then(|value| value.get("toolName"))
                .and_then(Value::as_str)
                .unwrap_or("unknown")
        ),
        ContextItemKind::CustomMessage => "Custom context message".into(),
        ContextItemKind::BranchSummary => "Branch summary".into(),
        ContextItemKind::CompactionSummary => "Compaction summary".into(),
        ContextItemKind::System => "System context".into(),
        ContextItemKind::ToolDefinition => "Tool definition".into(),
        ContextItemKind::Other => "Context item".into(),
    }
}

fn message_content(message: Option<&Value>) -> MessageContent {
    let Some(message) = message else {
        return MessageContent::empty();
    };
    let Some(content) = message.get("content") else {
        return MessageContent::empty();
    };
    if let Some(text) = content.as_str() {
        return MessageContent::text(text);
    }
    let Some(blocks) = content.as_array() else {
        return MessageContent::empty();
    };
    MessageContent {
        parts: blocks.iter().filter_map(content_part).collect(),
    }
}

fn content_part(value: &Value) -> Option<ContentPart> {
    match value.get("type").and_then(Value::as_str) {
        Some("text") | Some("thinking") => value
            .get("text")
            .or_else(|| value.get("thinking"))
            .and_then(Value::as_str)
            .map(|text| ContentPart::Text(text.to_owned())),
        Some("image") => Some(ContentPart::Image(image_descriptor(value))),
        _ => value
            .as_str()
            .map(|text| ContentPart::Text(text.to_owned())),
    }
}

fn assistant_blocks(message: &Value) -> Vec<AssistantContentBlock> {
    if let Some(text) = message.get("content").and_then(Value::as_str) {
        return vec![AssistantContentBlock::Text(text.to_owned())];
    }
    let Some(content) = message.get("content").and_then(Value::as_array) else {
        return Vec::new();
    };
    content
        .iter()
        .filter_map(|block| match block.get("type").and_then(Value::as_str) {
            Some("text") => block
                .get("text")
                .and_then(Value::as_str)
                .map(|text| AssistantContentBlock::Text(text.to_owned())),
            Some("thinking") => block
                .get("thinking")
                .or_else(|| block.get("text"))
                .and_then(Value::as_str)
                .map(|text| AssistantContentBlock::Thinking {
                    text: text.to_owned(),
                    provider_signature: block
                        .get("signature")
                        .and_then(Value::as_str)
                        .map(str::to_owned),
                }),
            Some("toolCall") => Some(AssistantContentBlock::ToolCall {
                id: block.get("id").and_then(Value::as_str).unwrap_or("").into(),
                name: block
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown")
                    .into(),
                arguments: canonical_json(block.get("arguments").unwrap_or(&Value::Null)),
            }),
            Some("image") => Some(AssistantContentBlock::Image(image_descriptor(block))),
            _ => None,
        })
        .collect()
}

fn assistant_response_is_contextual(stop_reason: Option<&str>) -> bool {
    !matches!(stop_reason, Some("error" | "aborted"))
}

fn assistant_tool_calls(message: &Value, failed: &HashSet<String>) -> Vec<NormalizedToolCall> {
    message
        .get("content")
        .and_then(Value::as_array)
        .map(|blocks| {
            blocks
                .iter()
                .filter(|block| block.get("type").and_then(Value::as_str) == Some("toolCall"))
                .map(|block| {
                    let id = block
                        .get("id")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_owned();
                    NormalizedToolCall {
                        failed: failed.contains(&id),
                        id,
                        name: block
                            .get("name")
                            .and_then(Value::as_str)
                            .unwrap_or("unknown")
                            .to_owned(),
                    }
                })
                .collect()
        })
        .unwrap_or_default()
}

fn image_descriptor(value: &Value) -> ImageDescriptor {
    ImageDescriptor {
        media_type: value
            .get("mimeType")
            .or_else(|| value.get("media_type"))
            .and_then(Value::as_str)
            .map(str::to_owned),
        byte_length: value
            .get("data")
            .and_then(Value::as_str)
            .map(|data| data.len() as u64),
    }
}

fn parse_usage(value: Option<&Value>) -> ReportedUsage {
    let Some(usage) = value else {
        return ReportedUsage::default();
    };
    let cost = usage.get("cost");
    ReportedUsage {
        input: usage.get("input").and_then(Value::as_u64),
        output: usage.get("output").and_then(Value::as_u64),
        cache_read: usage.get("cacheRead").and_then(Value::as_u64),
        cache_write: usage.get("cacheWrite").and_then(Value::as_u64),
        cache_write_1h: usage.get("cacheWrite1h").and_then(Value::as_u64),
        reasoning: usage.get("reasoning").and_then(Value::as_u64),
        total_tokens: usage.get("totalTokens").and_then(Value::as_u64),
        cost: ReportedCost {
            input: cost
                .and_then(|value| value.get("input"))
                .and_then(Value::as_f64),
            output: cost
                .and_then(|value| value.get("output"))
                .and_then(Value::as_f64),
            cache_read: cost
                .and_then(|value| value.get("cacheRead"))
                .and_then(Value::as_f64),
            cache_write: cost
                .and_then(|value| value.get("cacheWrite"))
                .and_then(Value::as_f64),
            total: cost
                .and_then(|value| value.get("total"))
                .and_then(Value::as_f64),
        },
    }
}

fn canonical_json(value: &Value) -> String {
    match value {
        Value::Object(object) => {
            let mut keys: Vec<_> = object.keys().collect();
            keys.sort_unstable();
            let mut out = String::from("{");
            for (index, key) in keys.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                out.push_str(&serde_json::to_string(key).unwrap_or_else(|_| "\"\"".into()));
                out.push(':');
                out.push_str(&canonical_json(object.get(*key).unwrap_or(&Value::Null)));
            }
            out.push('}');
            out
        }
        Value::Array(array) => format!(
            "[{}]",
            array
                .iter()
                .map(canonical_json)
                .collect::<Vec<_>>()
                .join(",")
        ),
        _ => serde_json::to_string(value).unwrap_or_else(|_| "null".into()),
    }
}

fn extend_presence(item: &mut NormalizedContextItem, call_index: usize) {
    if let Some(last) = item.presence.last_mut() {
        if last.end_call.saturating_add(1) == call_index {
            last.end_call = call_index;
            return;
        }
    }
    item.presence.push(PresenceRange {
        start_call: call_index,
        end_call: call_index,
    });
}

use std::collections::BTreeMap;

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::BufReader;

    fn fixture(name: &str) -> NormalizedSession {
        let file = File::open(format!("fixtures/pi/{name}.jsonl")).expect("fixture");
        PiSourceAdapter
            .parse(&mut BufReader::new(file))
            .expect("normalized fixture")
    }

    #[test]
    fn branch_selection_and_compaction_are_source_local() {
        let session = fixture("compaction");
        assert_eq!(session.model_calls.len(), 3);
        assert_eq!(session.model_calls[2].context_item_ids.len(), 4);
        assert_eq!(session.compactions[0].tokens_before, Some(100));
        assert!(session
            .lineage
            .iter()
            .all(|edge| edge.kind == "frameworkCompaction"));
    }

    fn suffixes(session: &NormalizedSession, index: usize) -> Vec<String> {
        session.model_calls[index - 1]
            .context_item_ids
            .iter()
            .map(|id| id.rsplit(':').next().unwrap_or(id).to_owned())
            .collect()
    }

    #[test]
    fn historical_context_membership_and_branch_selection_are_exact() {
        let simple = fixture("simple");
        assert_eq!(suffixes(&simple, 1), vec!["u1"]);
        assert_eq!(suffixes(&simple, 2), vec!["u1", "a1", "u2"]);
        let branch = fixture("branch");
        assert_eq!(suffixes(&branch, 2), vec!["u1", "a1", "u2b"]);
        let tools = fixture("tools");
        assert_eq!(suffixes(&tools, 2), vec!["u1", "a1", "r1"]);
    }

    #[test]
    fn errored_and_aborted_assistants_are_not_reused_as_context() {
        for fixture_name in ["errored-assistant", "aborted-assistant"] {
            let session = fixture(fixture_name);
            assert_eq!(session.model_calls.len(), 2);
            assert!(session.model_calls[0]
                .context_item_ids
                .iter()
                .all(|id| !id.ends_with(":entry:a1")));
            assert!(session.model_calls[1]
                .context_item_ids
                .iter()
                .all(|id| !id.ends_with(":entry:a1")));
            assert!(session
                .context_items
                .iter()
                .all(|item| !item.id.ends_with(":entry:a1")));
        }
    }

    #[test]
    fn compaction_preserves_retained_tail_and_starts_summary_exposure() {
        let session = fixture("compaction");
        let event = &session.compactions[0];
        assert_eq!(event.before_model_call, 3);
        assert!(event
            .source_item_ids
            .iter()
            .any(|id| id.ends_with(":entry:u1")));
        assert!(event
            .retained_item_ids
            .iter()
            .any(|id| id.ends_with(":entry:r1")));
        let summary = session
            .context_items
            .iter()
            .find(|item| item.id == event.summary_item_id)
            .expect("summary");
        assert_eq!(summary.first_model_call, 3);
        assert_eq!(
            summary.presence,
            vec![PresenceRange {
                start_call: 3,
                end_call: 3
            }]
        );
    }

    #[test]
    fn terminal_compaction_summary_is_kept_without_fake_presence() {
        let session = fixture("terminal-compaction");
        let event = &session.compactions[0];
        let summary = session
            .context_items
            .iter()
            .find(|item| item.id == event.summary_item_id)
            .expect("summary");
        assert!(summary.presence.is_empty());
        assert_eq!(summary.first_model_call, 0);
    }

    #[test]
    fn malformed_parent_is_reported_by_adapter() {
        let file = File::open("fixtures/pi/malformed-parent.jsonl").expect("fixture");
        let error = PiSourceAdapter
            .parse(&mut BufReader::new(file))
            .expect_err("must fail");
        assert!(error.to_string().contains("broken parent link"));
    }
}
