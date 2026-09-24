use super::parser::{parse_reader, PiEntry};
use crate::domain::*;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    io::BufRead,
    path::{Component, Path, PathBuf},
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

#[derive(Debug)]
struct PendingCompaction {
    record_id: String,
    source_item_ids: Vec<String>,
    retained_item_ids: Vec<String>,
    before_model_call: usize,
    tokens_before: Option<u64>,
}

struct ToolInvocation<'a> {
    name: Option<&'a str>,
    arguments: Option<&'a Value>,
}

const MAX_LABEL_CHARS: usize = 160;

fn insert_item(
    items: &mut Vec<NormalizedContextItem>,
    item_indices: &mut HashMap<String, ItemIndex>,
    item_id: String,
    item: NormalizedContextItem,
) -> ItemIndex {
    if let Some(index) = item_indices.get(&item_id).copied() {
        return index;
    }
    let index = ItemIndex(items.len());
    item_indices.insert(item_id, index);
    items.push(item);
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

    let mut items = Vec::<NormalizedContextItem>::new();
    let mut item_indices = HashMap::<String, ItemIndex>::new();
    let mut calls = Vec::new();
    let mut active = Vec::<ItemIndex>::new();
    let mut compactions = Vec::<PendingCompaction>::new();
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
    let tool_invocations = collect_tool_invocations(entries, &selected);
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
                    let item = &items[item_index.0];
                    let Some(boundary) = first_kept_position else {
                        return true;
                    };
                    item.source_record_id
                        .as_deref()
                        .and_then(|record_id| branch_positions.get(record_id).copied())
                        .is_none_or(|position| position < boundary)
                });
            let old = old_indexes
                .iter()
                .map(|item_index| items[item_index.0].id.clone())
                .collect::<Vec<_>>();
            let retained = retained_indexes
                .iter()
                .map(|item_index| items[item_index.0].id.clone())
                .collect::<Vec<_>>();
            active.clear();
            active.push(summary_index);
            active.extend(retained_indexes);
            last_compaction = Some(summary_id);
            compactions.push(PendingCompaction {
                record_id: entry.id.clone(),
                source_item_ids: old,
                retained_item_ids: retained,
                before_model_call: calls.len() + 1,
                tokens_before: entry.value.get("tokensBefore").and_then(Value::as_u64),
            });
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
                .map(|item_index| items[item_index.0].id.clone())
                .collect::<Vec<_>>();
            for item_index in &active {
                let item = &mut items[item_index.0];
                item.last_model_call = index;
                extend_presence(item, index);
                if item.first_model_call == 0 {
                    item.first_model_call = index;
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
                assistant_id.clone(),
                NormalizedContextItem {
                    id: assistant_id,
                    kind: ContextItemKind::AssistantMessage,
                    label: item_label(
                        ContextItemKind::AssistantMessage,
                        Some(model_message),
                        &tool_invocations,
                        working_directory.as_deref(),
                    ),
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
            item_id.clone(),
            NormalizedContextItem {
                id: item_id,
                kind: item_kind,
                label: item_label(
                    item_kind,
                    message_value,
                    &tool_invocations,
                    working_directory.as_deref(),
                ),
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

    for item in &mut items {
        if item.first_model_call == 0 {
            item.presence.clear();
        } else if let Some(last) = item.presence.last() {
            item.last_model_call = last.end_call;
        }
    }

    let mut lineage = Vec::new();
    let mut compaction_dtos = Vec::new();
    for compaction in compactions {
        let summary_id = format!("pi:{id}:compaction:{}", compaction.record_id);
        for old_id in &compaction.source_item_ids {
            lineage.push(NormalizedLineageEdge {
                from: old_id.clone(),
                to: summary_id.clone(),
                kind: "frameworkCompaction".into(),
            });
        }
        compaction_dtos.push(NormalizedCompaction {
            id: summary_id.clone(),
            before_model_call: compaction.before_model_call,
            source_item_ids: compaction.source_item_ids,
            retained_item_ids: compaction.retained_item_ids,
            summary_item_id: summary_id,
            tokens_before: compaction.tokens_before,
        });
    }
    let terminal_boundary = calls.len() + 1;
    let terminal_summary_ids: HashSet<String> = compaction_dtos
        .iter()
        .filter(|event| event.before_model_call == terminal_boundary)
        .map(|event| event.summary_item_id.clone())
        .collect();
    let mut context_items: Vec<_> = items
        .into_iter()
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

fn item_label(
    kind: ContextItemKind,
    message: Option<&Value>,
    tool_invocations: &HashMap<&str, Vec<ToolInvocation<'_>>>,
    working_directory: Option<&str>,
) -> String {
    let label = match kind {
        ContextItemKind::UserMessage => message.map_or_else(
            || "User message".into(),
            |message| {
                message_text_line(message).map_or_else(
                    || {
                        if message_has_image(message) {
                            "User · Image".into()
                        } else {
                            "User message".into()
                        }
                    },
                    |text| format!("User · {text}"),
                )
            },
        ),
        ContextItemKind::AssistantMessage => {
            message.map_or_else(|| "Assistant response".into(), assistant_message_label)
        }
        ContextItemKind::ToolResult => message.map_or_else(
            || "Tool result".into(),
            |message| tool_result_label(message, tool_invocations, working_directory),
        ),
        ContextItemKind::CustomMessage => "Custom context message".into(),
        ContextItemKind::BranchSummary => "Branch summary".into(),
        ContextItemKind::CompactionSummary => "Compaction summary".into(),
        ContextItemKind::System => "System context".into(),
        ContextItemKind::ToolDefinition => "Tool definition".into(),
        ContextItemKind::Other => "Context item".into(),
    };
    bounded_label(&label)
}

// Index exact call IDs only on the selected branch; duplicate IDs remain ambiguous and fall back.
fn collect_tool_invocations<'a>(
    entries: &'a [PiEntry],
    selected: &[usize],
) -> HashMap<&'a str, Vec<ToolInvocation<'a>>> {
    let mut invocations = HashMap::<&str, Vec<ToolInvocation<'_>>>::new();
    for entry_index in selected {
        let entry = &entries[*entry_index];
        let Some(message) = message(entry) else {
            continue;
        };
        if message.get("role").and_then(Value::as_str) != Some("assistant") {
            continue;
        }
        let Some(blocks) = message.get("content").and_then(Value::as_array) else {
            continue;
        };
        for block in blocks {
            if block.get("type").and_then(Value::as_str) != Some("toolCall") {
                continue;
            }
            let Some(id) = block
                .get("id")
                .and_then(Value::as_str)
                .filter(|id| !id.is_empty())
            else {
                continue;
            };
            invocations.entry(id).or_default().push(ToolInvocation {
                name: block.get("name").and_then(Value::as_str),
                arguments: block.get("arguments"),
            });
        }
    }
    invocations
}

fn assistant_message_label(message: &Value) -> String {
    if let Some(text) = message_text_line(message) {
        return format!("Assistant · {text}");
    }
    if let Some(tool_summary) = assistant_tool_summary(message) {
        return format!("Assistant · {tool_summary}");
    }
    if message_has_image(message) {
        return "Assistant · Image".into();
    }
    "Assistant response".into()
}

fn assistant_tool_summary(message: &Value) -> Option<String> {
    let blocks = message.get("content")?.as_array()?;
    let mut shown_names = Vec::with_capacity(3);
    let mut tool_count = 0;
    for block in blocks
        .iter()
        .filter(|block| block.get("type").and_then(Value::as_str) == Some("toolCall"))
    {
        tool_count += 1;
        if shown_names.len() < 3 {
            shown_names.push(
                block
                    .get("name")
                    .and_then(Value::as_str)
                    .map(bounded_label)
                    .filter(|name| !name.is_empty())
                    .unwrap_or_else(|| "Tool".into()),
            );
        }
    }
    if tool_count == 0 {
        return None;
    }
    let shown = shown_names.join(", ");
    Some(if tool_count > 3 {
        format!("{shown}, +{} more", tool_count - 3)
    } else {
        shown
    })
}

fn message_text_line(message: &Value) -> Option<String> {
    let content = message.get("content")?;
    if let Some(text) = content.as_str() {
        return first_nonempty_line(text);
    }
    let blocks = content.as_array()?;
    for block in blocks {
        let text = block.as_str().or_else(|| {
            (block.get("type").and_then(Value::as_str) == Some("text"))
                .then(|| block.get("text").and_then(Value::as_str))
                .flatten()
        });
        if let Some(text) = text {
            if let Some(line) = first_nonempty_line(text) {
                return Some(line);
            }
        }
    }
    None
}

fn first_nonempty_line(text: &str) -> Option<String> {
    text.split(['\r', '\n', '\u{2028}', '\u{2029}'])
        .map(bounded_label)
        .find(|line| !line.is_empty())
}

fn message_has_image(message: &Value) -> bool {
    message
        .get("content")
        .and_then(Value::as_array)
        .is_some_and(|blocks| {
            blocks
                .iter()
                .any(|block| block.get("type").and_then(Value::as_str) == Some("image"))
        })
}

fn tool_result_label(
    message: &Value,
    tool_invocations: &HashMap<&str, Vec<ToolInvocation<'_>>>,
    working_directory: Option<&str>,
) -> String {
    let result_tool_name = message
        .get("toolName")
        .and_then(Value::as_str)
        .filter(|name| !name.is_empty());
    let fallback = || tool_result_fallback(result_tool_name);
    let Some(tool_call_id) = message
        .get("toolCallId")
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty())
    else {
        return fallback();
    };
    let Some([invocation]) = tool_invocations.get(tool_call_id).map(Vec::as_slice) else {
        return fallback();
    };
    let Some(tool_name) = invocation.name.filter(|name| !name.is_empty()) else {
        return fallback();
    };
    if result_tool_name.is_some_and(|result_name| result_name != tool_name) {
        return fallback();
    }
    let Some(arguments) = invocation.arguments.and_then(Value::as_object) else {
        return fallback();
    };

    // These names and fields match Pi's built-in read/write/edit, bash, grep, and find schemas.
    // Extensions and other tools intentionally remain generic instead of guessing argument meaning.
    let (display_name, argument) = match tool_name {
        "read" | "write" | "edit" => (
            match tool_name {
                "read" => "Read",
                "write" => "Write",
                _ => "Edit",
            },
            arguments
                .get("path")
                .and_then(Value::as_str)
                .filter(|path| has_visible_label_text(path))
                .map(|path| bounded_label(&display_path_argument(path, working_directory))),
        ),
        "bash" => (
            "Bash",
            arguments
                .get("command")
                .and_then(Value::as_str)
                .filter(|command| has_visible_label_text(command))
                .map(bounded_label),
        ),
        "grep" | "find" => (
            if tool_name == "grep" { "Grep" } else { "Find" },
            arguments
                .get("pattern")
                .and_then(Value::as_str)
                .filter(|pattern| has_visible_label_text(pattern))
                .map(bounded_label),
        ),
        _ => return fallback(),
    };
    let Some(argument) = argument else {
        return fallback();
    };
    format!("{display_name} · {argument}")
}

fn tool_result_fallback(tool_name: Option<&str>) -> String {
    let Some(tool_name) = tool_name else {
        return "Tool result".into();
    };
    let display_name = match tool_name {
        "read" => "Read",
        "write" => "Write",
        "edit" => "Edit",
        "bash" => "Bash",
        "grep" => "Grep",
        "find" => "Find",
        other => other,
    };
    let display_name = bounded_label(display_name);
    if display_name.is_empty() {
        "Tool result".into()
    } else {
        format!("{display_name} result")
    }
}

fn display_path_argument(path: &str, working_directory: Option<&str>) -> String {
    // Use lexical components only; historical labels must not depend on the current filesystem.
    let source_path = Path::new(path);
    if !source_path.is_absolute() && looks_like_windows_absolute_path(path) {
        return path.replace('\\', "/");
    }
    let Some(working_directory) = working_directory
        .map(Path::new)
        .filter(|path| path.is_absolute())
    else {
        return path.replace('\\', "/");
    };
    let Some(normalized_working_directory) = normalize_lexical_path(working_directory) else {
        return path.replace('\\', "/");
    };
    let target_path = if source_path.is_absolute() {
        source_path.to_path_buf()
    } else {
        normalized_working_directory.join(source_path)
    };
    let Some(normalized_target) = normalize_lexical_path(&target_path) else {
        return path.replace('\\', "/");
    };
    let Ok(relative_path) = normalized_target.strip_prefix(&normalized_working_directory) else {
        return path.replace('\\', "/");
    };
    let components = relative_path
        .components()
        .filter_map(|component| match component {
            Component::Normal(component) => Some(component.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>();
    if components.is_empty() {
        ".".into()
    } else {
        components.join("/")
    }
}

fn normalize_lexical_path(path: &Path) -> Option<PathBuf> {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(component.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => {
                if !normalized.pop() {
                    return None;
                }
            }
            Component::Normal(segment) => normalized.push(segment),
        }
    }
    Some(normalized)
}

fn looks_like_windows_absolute_path(path: &str) -> bool {
    let bytes = path.as_bytes();
    (bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && matches!(bytes[2], b'\\' | b'/'))
        || path.starts_with("\\\\")
}

fn is_unsafe_label_control(character: char) -> bool {
    character.is_control()
        || matches!(
            character,
            '\u{061c}'
                | '\u{200e}'
                | '\u{200f}'
                | '\u{202a}'..='\u{202e}'
                | '\u{2066}'..='\u{2069}'
        )
}

fn has_visible_label_text(value: &str) -> bool {
    value
        .chars()
        .any(|character| !character.is_whitespace() && !is_unsafe_label_control(character))
}

fn bounded_label(value: &str) -> String {
    let mut bounded = String::with_capacity(MAX_LABEL_CHARS);
    let mut character_count = 0;
    let mut pending_space = false;
    let mut truncated = false;
    for character in value.chars() {
        if character.is_whitespace() {
            pending_space = !bounded.is_empty();
            continue;
        }
        if is_unsafe_label_control(character) {
            continue;
        }
        if pending_space {
            if character_count == MAX_LABEL_CHARS {
                truncated = true;
                break;
            }
            bounded.push(' ');
            character_count += 1;
            pending_space = false;
        }
        if character_count == MAX_LABEL_CHARS {
            truncated = true;
            break;
        }
        bounded.push(character);
        character_count += 1;
    }
    if truncated {
        bounded.pop();
        bounded.push('…');
    }
    bounded
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
        return MessageContent {
            parts: vec![ContentPart::Unsupported],
        };
    };
    MessageContent {
        parts: blocks.iter().map(content_part).collect(),
    }
}

fn content_part(value: &Value) -> ContentPart {
    match value.get("type").and_then(Value::as_str) {
        Some("text") | Some("thinking") => value
            .get("text")
            .or_else(|| value.get("thinking"))
            .and_then(Value::as_str)
            .map_or(ContentPart::Unsupported, |text| {
                ContentPart::Text(text.to_owned())
            }),
        Some("image") => ContentPart::Image(image_descriptor(value)),
        _ => value.as_str().map_or(ContentPart::Unsupported, |text| {
            ContentPart::Text(text.to_owned())
        }),
    }
}

fn assistant_blocks(message: &Value) -> Vec<AssistantContentBlock> {
    if let Some(text) = message.get("content").and_then(Value::as_str) {
        return vec![AssistantContentBlock::Text(text.to_owned())];
    }
    let Some(content) = message.get("content").and_then(Value::as_array) else {
        return vec![AssistantContentBlock::Unsupported];
    };
    content
        .iter()
        .map(|block| match block.get("type").and_then(Value::as_str) {
            Some("text") => block
                .get("text")
                .and_then(Value::as_str)
                .map_or(AssistantContentBlock::Unsupported, |text| {
                    AssistantContentBlock::Text(text.to_owned())
                }),
            Some("thinking") => block
                .get("thinking")
                .or_else(|| block.get("text"))
                .and_then(Value::as_str)
                .map_or(AssistantContentBlock::Unsupported, |text| {
                    AssistantContentBlock::Thinking {
                        text: text.to_owned(),
                        provider_signature: block
                            .get("signature")
                            .and_then(Value::as_str)
                            .map(str::to_owned),
                    }
                }),
            Some("toolCall") => {
                let (Some(id), Some(name), Some(arguments)) = (
                    block.get("id").and_then(Value::as_str),
                    block.get("name").and_then(Value::as_str),
                    block.get("arguments"),
                ) else {
                    return AssistantContentBlock::Unsupported;
                };
                AssistantContentBlock::ToolCall {
                    id: id.into(),
                    name: name.into(),
                    arguments: canonical_json(arguments),
                }
            }
            Some("image") => AssistantContentBlock::Image(image_descriptor(block)),
            _ => AssistantContentBlock::Unsupported,
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
    // serde_json::Map uses its deterministic sorted-key representation unless
    // the crate's `preserve_order` feature is enabled. This crate does not
    // enable that feature, so Serde provides the escaping and ordering here
    // without a second handwritten JSON serializer.
    serde_json::to_string(value).expect("serde_json::Value is serializable")
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
    use std::io::{BufReader, Cursor};

    fn fixture(name: &str) -> NormalizedSession {
        let file = File::open(format!("fixtures/pi/{name}.jsonl")).expect("fixture");
        PiSourceAdapter
            .parse(&mut BufReader::new(file))
            .expect("normalized fixture")
    }

    fn parse_records(records: &[Value]) -> NormalizedSession {
        let jsonl = records
            .iter()
            .map(|record| serde_json::to_string(record).expect("JSON record"))
            .collect::<Vec<_>>()
            .join("\n");
        PiSourceAdapter
            .parse(&mut Cursor::new(jsonl))
            .expect("normalized test session")
    }

    fn message_record(id: &str, parent: Option<&str>, message: Value) -> Value {
        serde_json::json!({
            "type": "message",
            "id": id,
            "parentId": parent,
            "message": message,
        })
    }

    fn item_label_for_record<'a>(session: &'a NormalizedSession, record_id: &str) -> &'a str {
        session
            .context_items
            .iter()
            .find(|item| item.source_record_id.as_deref() == Some(record_id))
            .map(|item| item.label.as_str())
            .expect("context item for source record")
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
    fn malformed_or_unknown_content_is_preserved_as_unsupported() {
        let message = serde_json::json!({
            "content": [
                {"type": "text", "text": "known"},
                {"type": "futureBlock", "value": "do not expose"},
                {"type": "toolCall", "id": "call-1", "name": "bash"}
            ]
        });
        let blocks = assistant_blocks(&message);
        assert!(matches!(blocks[0], AssistantContentBlock::Text(_)));
        assert!(matches!(blocks[1], AssistantContentBlock::Unsupported));
        assert!(matches!(blocks[2], AssistantContentBlock::Unsupported));

        let content = message_content(Some(&serde_json::json!({
            "content": [{"type": "futureBlock", "value": "do not expose"}]
        })));
        assert!(matches!(content.parts[0], ContentPart::Unsupported));
    }

    #[test]
    fn canonical_tool_arguments_are_sorted_and_serde_escaped() {
        let first: Value =
            serde_json::from_str(r#"{"z":"é","a":{"quote":"\\\"","items":[null,true,2]}}"#)
                .expect("JSON");
        let second: Value =
            serde_json::from_str(r#"{"a":{"items":[null,true,2],"quote":"\\\""},"z":"é"}"#)
                .expect("JSON");
        assert_eq!(canonical_json(&first), canonical_json(&second));
        assert_eq!(
            canonical_json(&first),
            r#"{"a":{"items":[null,true,2],"quote":"\\\""},"z":"é"}"#
        );
    }

    #[test]
    fn source_labels_use_matched_tool_arguments_and_visible_message_text() {
        let records = vec![
            serde_json::json!({"type":"session","id":"labels","cwd":"/tmp/project"}),
            message_record(
                "u1",
                None,
                serde_json::json!({"role":"user","content":[{"type":"text","text":"\n  Fix parser  \nsecond line"}]}),
            ),
            message_record(
                "a1",
                Some("u1"),
                serde_json::json!({
                    "role":"assistant",
                    "stopReason":"toolUse",
                    "content":[
                        {"type":"toolCall","id":"read-1","name":"read","arguments":{"path":"src/analysis/../analysis/mod.rs"}},
                        {"type":"toolCall","id":"write-1","name":"write","arguments":{"path":"src/new.rs","content":"private body omitted"}},
                        {"type":"toolCall","id":"edit-1","name":"edit","arguments":{"path":"src/old.rs","edits":[]}},
                        {"type":"toolCall","id":"bash-1","name":"bash","arguments":{"command":" \n cargo test\t--workspace  "}},
                        {"type":"toolCall","id":"grep-1","name":"grep","arguments":{"pattern":"toolCallId"}},
                        {"type":"toolCall","id":"find-1","name":"find","arguments":{"pattern":"**/*.rs"}},
                        {"type":"toolCall","id":"read-2","name":"read","arguments":{"path":"/tmp/project/src/analysis/mod.rs"}}
                    ]
                }),
            ),
            message_record(
                "r1",
                Some("a1"),
                serde_json::json!({"role":"toolResult","toolCallId":"read-1","toolName":"read","content":"ok"}),
            ),
            message_record(
                "r2",
                Some("r1"),
                serde_json::json!({"role":"toolResult","toolCallId":"write-1","toolName":"write","content":"ok"}),
            ),
            message_record(
                "r3",
                Some("r2"),
                serde_json::json!({"role":"toolResult","toolCallId":"edit-1","toolName":"edit","content":"ok"}),
            ),
            message_record(
                "r4",
                Some("r3"),
                serde_json::json!({"role":"toolResult","toolCallId":"bash-1","toolName":"bash","content":"ok"}),
            ),
            message_record(
                "r5",
                Some("r4"),
                serde_json::json!({"role":"toolResult","toolCallId":"grep-1","toolName":"grep","content":"ok"}),
            ),
            message_record(
                "r6",
                Some("r5"),
                serde_json::json!({"role":"toolResult","toolCallId":"find-1","toolName":"find","content":"ok"}),
            ),
            message_record(
                "r7",
                Some("r6"),
                serde_json::json!({"role":"toolResult","toolCallId":"read-2","toolName":"read","content":"ok"}),
            ),
            message_record(
                "a2",
                Some("r7"),
                serde_json::json!({"role":"assistant","stopReason":"stop","content":[{"type":"text","text":" \n Completed successfully\nmore detail"}]}),
            ),
            message_record(
                "u3",
                Some("a2"),
                serde_json::json!({"role":"user","content":"next turn"}),
            ),
            message_record(
                "a3",
                Some("u3"),
                serde_json::json!({"role":"assistant","stopReason":"stop","content":"done"}),
            ),
        ];
        let session = parse_records(&records);

        assert_eq!(item_label_for_record(&session, "u1"), "User · Fix parser");
        assert_eq!(
            item_label_for_record(&session, "a1"),
            "Assistant · read, write, edit, +4 more"
        );
        assert_eq!(
            item_label_for_record(&session, "r1"),
            "Read · src/analysis/mod.rs"
        );
        assert_eq!(item_label_for_record(&session, "r2"), "Write · src/new.rs");
        assert_eq!(item_label_for_record(&session, "r3"), "Edit · src/old.rs");
        assert_eq!(
            item_label_for_record(&session, "r4"),
            "Bash · cargo test --workspace"
        );
        assert_eq!(item_label_for_record(&session, "r5"), "Grep · toolCallId");
        assert_eq!(item_label_for_record(&session, "r6"), "Find · **/*.rs");
        assert_eq!(
            item_label_for_record(&session, "r7"),
            item_label_for_record(&session, "r1")
        );
        assert_eq!(
            item_label_for_record(&session, "a2"),
            "Assistant · Completed successfully"
        );

        let repeated = parse_records(&records);
        assert_eq!(
            item_label_for_record(&repeated, "r1"),
            item_label_for_record(&session, "r1")
        );
        let mut appended_records = records.clone();
        appended_records.push(message_record(
            "u4",
            Some("a3"),
            serde_json::json!({"role":"user","content":"unrelated later request"}),
        ));
        let appended = parse_records(&appended_records);
        assert_eq!(
            item_label_for_record(&appended, "r1"),
            item_label_for_record(&session, "r1")
        );
        let mut reordered = session.clone();
        reordered.context_items.reverse();
        assert_eq!(
            item_label_for_record(&reordered, "r1"),
            item_label_for_record(&session, "r1")
        );
        let mut filtered = session.clone();
        filtered
            .context_items
            .retain(|item| item.source_record_id.as_deref() != Some("r1"));
        assert_eq!(
            item_label_for_record(&filtered, "r7"),
            item_label_for_record(&session, "r7")
        );
    }

    #[test]
    fn tool_result_labels_fall_back_on_missing_wrong_ambiguous_or_mismatched_metadata() {
        let session = parse_records(&[
            serde_json::json!({"type":"session","id":"fallbacks","cwd":"/tmp/project"}),
            message_record(
                "u1",
                None,
                serde_json::json!({"role":"user","content":"start"}),
            ),
            message_record(
                "a1",
                Some("u1"),
                serde_json::json!({
                    "role":"assistant",
                    "stopReason":"toolUse",
                    "content":[
                        {"type":"toolCall","id":"wrong-args","name":"read","arguments":{"path":12}},
                        {"type":"toolCall","id":"unknown","name":"customSearch","arguments":{"query":"private"}},
                        {"type":"toolCall","id":"duplicate","name":"read","arguments":{"path":"first.rs"}},
                        {"type":"toolCall","id":"duplicate","name":"read","arguments":{"path":"second.rs"}},
                        {"type":"toolCall","id":"mismatch","name":"read","arguments":{"path":"secret.rs"}},
                        {"type":"toolCall","id":"known","name":"read","arguments":{"path":"src/known.rs"}},
                        {"type":"toolCall","id":"no-command","name":"bash","arguments":{"timeout":2}}
                    ]
                }),
            ),
            message_record(
                "r1",
                Some("a1"),
                serde_json::json!({"role":"toolResult","toolCallId":"wrong-args","toolName":"read","content":"ok"}),
            ),
            message_record(
                "r2",
                Some("r1"),
                serde_json::json!({"role":"toolResult","toolCallId":"unknown","toolName":"customSearch","content":"ok"}),
            ),
            message_record(
                "r3",
                Some("r2"),
                serde_json::json!({"role":"toolResult","toolCallId":"duplicate","toolName":"read","content":"ok"}),
            ),
            message_record(
                "r4",
                Some("r3"),
                serde_json::json!({"role":"toolResult","toolName":"bash","content":"ok"}),
            ),
            message_record(
                "r5",
                Some("r4"),
                serde_json::json!({"role":"toolResult","toolCallId":"mismatch","toolName":"write","content":"ok"}),
            ),
            message_record(
                "r6",
                Some("r5"),
                serde_json::json!({"role":"toolResult","toolCallId":"known","content":"ok"}),
            ),
            message_record(
                "r7",
                Some("r6"),
                serde_json::json!({"role":"toolResult","toolCallId":"no-command","toolName":"bash","content":"ok"}),
            ),
            message_record(
                "a2",
                Some("r7"),
                serde_json::json!({"role":"assistant","stopReason":"stop","content":"done"}),
            ),
        ]);

        assert_eq!(item_label_for_record(&session, "r1"), "Read result");
        assert_eq!(item_label_for_record(&session, "r2"), "customSearch result");
        assert_eq!(item_label_for_record(&session, "r3"), "Read result");
        assert_eq!(item_label_for_record(&session, "r4"), "Bash result");
        assert_eq!(item_label_for_record(&session, "r5"), "Write result");
        assert_eq!(item_label_for_record(&session, "r6"), "Read · src/known.rs");
        assert_eq!(item_label_for_record(&session, "r7"), "Bash result");
    }

    #[test]
    fn tool_matching_is_scoped_to_the_selected_branch() {
        let session = parse_records(&[
            serde_json::json!({"type":"session","id":"branches","cwd":"/tmp/project"}),
            message_record(
                "u1",
                None,
                serde_json::json!({"role":"user","content":"start"}),
            ),
            message_record(
                "a-left",
                Some("u1"),
                serde_json::json!({"role":"assistant","stopReason":"toolUse","content":[{"type":"toolCall","id":"shared","name":"read","arguments":{"path":"left.rs"}}]}),
            ),
            message_record(
                "r-left",
                Some("a-left"),
                serde_json::json!({"role":"toolResult","toolCallId":"shared","toolName":"read","content":"left"}),
            ),
            message_record(
                "a-right",
                Some("u1"),
                serde_json::json!({"role":"assistant","stopReason":"toolUse","content":[{"type":"toolCall","id":"shared","name":"read","arguments":{"path":"right.rs"}}]}),
            ),
            message_record(
                "r-right",
                Some("a-right"),
                serde_json::json!({"role":"toolResult","toolCallId":"shared","toolName":"read","content":"right"}),
            ),
            message_record(
                "a-end",
                Some("r-right"),
                serde_json::json!({"role":"assistant","stopReason":"stop","content":"done"}),
            ),
        ]);

        assert_eq!(
            item_label_for_record(&session, "r-right"),
            "Read · right.rs"
        );
        assert!(!session
            .context_items
            .iter()
            .any(|item| { item.source_record_id.as_deref() == Some("r-left") }));
    }

    #[test]
    fn message_fallbacks_cover_images_and_unavailable_content() {
        let session = parse_records(&[
            serde_json::json!({"type":"session","id":"message-fallbacks"}),
            message_record(
                "u-image",
                None,
                serde_json::json!({"role":"user","content":[{"type":"image","data":"AA==","mimeType":"image/png"}]}),
            ),
            message_record(
                "a-image",
                Some("u-image"),
                serde_json::json!({"role":"assistant","stopReason":"stop","content":[{"type":"image","data":"AA==","mimeType":"image/png"}]}),
            ),
            message_record(
                "u-missing",
                Some("a-image"),
                serde_json::json!({"role":"user"}),
            ),
            message_record(
                "a-missing",
                Some("u-missing"),
                serde_json::json!({"role":"assistant","stopReason":"stop"}),
            ),
            message_record(
                "u-text",
                Some("a-missing"),
                serde_json::json!({"role":"user","content":"continued"}),
            ),
            message_record(
                "a-end",
                Some("u-text"),
                serde_json::json!({"role":"assistant","stopReason":"stop","content":"done"}),
            ),
        ]);

        assert_eq!(item_label_for_record(&session, "u-image"), "User · Image");
        assert_eq!(
            item_label_for_record(&session, "a-image"),
            "Assistant · Image"
        );
        assert_eq!(item_label_for_record(&session, "u-missing"), "User message");
        assert_eq!(
            item_label_for_record(&session, "a-missing"),
            "Assistant response"
        );
    }

    #[test]
    fn other_context_kinds_keep_explicit_kind_specific_labels() {
        let invocations = HashMap::<&str, Vec<ToolInvocation<'_>>>::new();
        let assistant_with_text_and_tool = serde_json::json!({
            "content": [
                {"type":"text","text":"  Visible answer\nignored suffix"},
                {"type":"toolCall","id":"tool-1","name":"read","arguments":{"path":"private.rs"}}
            ]
        });
        assert_eq!(
            item_label(
                ContextItemKind::AssistantMessage,
                Some(&assistant_with_text_and_tool),
                &invocations,
                None,
            ),
            "Assistant · Visible answer"
        );
        for (kind, expected) in [
            (ContextItemKind::System, "System context"),
            (ContextItemKind::ToolDefinition, "Tool definition"),
            (ContextItemKind::CustomMessage, "Custom context message"),
            (ContextItemKind::BranchSummary, "Branch summary"),
            (ContextItemKind::CompactionSummary, "Compaction summary"),
            (ContextItemKind::Other, "Context item"),
        ] {
            assert_eq!(item_label(kind, None, &invocations, None), expected);
        }
    }

    #[test]
    fn label_normalization_is_safe_unicode_aware_and_bounded() {
        assert_eq!(
            bounded_label("  Résumé\t parser\u{0007}\u{202e} status\n "),
            "Résumé parser status"
        );
        let long = bounded_label(&format!("Read · {}", "📦".repeat(200)));
        assert_eq!(long.chars().count(), MAX_LABEL_CHARS);
        assert!(long.ends_with('…'));
        assert!(bounded_label(&"😀".repeat(MAX_LABEL_CHARS)).chars().count() <= MAX_LABEL_CHARS);
    }

    #[test]
    fn file_labels_are_lexically_relative_only_inside_the_session_directory() {
        let cwd = Some("/tmp/project");
        assert_eq!(
            display_path_argument("src/../src/main.rs", cwd),
            "src/main.rs"
        );
        assert_eq!(
            display_path_argument("/tmp/project/src/main.rs", cwd),
            "src/main.rs"
        );
        assert_eq!(display_path_argument("/tmp/project", cwd), ".");
        assert_eq!(
            display_path_argument("../../etc/passwd", cwd),
            "../../etc/passwd"
        );
        assert_eq!(display_path_argument("/etc/passwd", cwd), "/etc/passwd");
        assert_eq!(
            display_path_argument("/tmp/project2/secret.txt", cwd),
            "/tmp/project2/secret.txt"
        );
        assert_eq!(display_path_argument("src/main.rs", None), "src/main.rs");
        assert_eq!(
            display_path_argument(r"C:\outside\secret.txt", cwd),
            "C:/outside/secret.txt"
        );
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
