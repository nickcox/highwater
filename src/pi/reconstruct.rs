mod interpret;
mod state;
mod system_context;
#[cfg(test)]
mod system_context_tests;
use state::ReconstructionState;

use super::{
    branch::select_branch,
    parser::{parse_reader, PiEntry, PiParseError},
};
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

struct ToolInvocation<'a> {
    name: Option<&'a str>,
    arguments: Option<&'a Value>,
}

const MAX_LABEL_CHARS: usize = 160;

fn source_error_from_parse(error: PiParseError) -> SourceError {
    match error {
        PiParseError::Io(source) => SourceError::Io(source),
        PiParseError::Json { line, source } => SourceError::Json { line, source },
    }
}

impl SessionSourceAdapter for PiSourceAdapter {
    fn source_descriptor(&self) -> SourceDescriptor {
        SourceDescriptor {
            kind: "pi".into(),
            version: "jsonl-v1".into(),
            cost_basis: CostBasis::PiModelRates,
        }
    }

    fn parse(&self, input: &mut dyn BufRead) -> Result<NormalizedSession, SourceError> {
        self.parse_reader_with_stats(input)
            .map(|(session, _)| session)
    }
}

impl PiSourceAdapter {
    fn parse_reader_with_stats(
        &self,
        input: &mut dyn BufRead,
    ) -> Result<(NormalizedSession, PiParseStats), SourceError> {
        let entries = parse_reader(input).map_err(source_error_from_parse)?;
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

    pub(crate) fn parse_path_with_stats(
        &self,
        path: &std::path::Path,
    ) -> Result<(NormalizedSession, PiParseStats), SourceError> {
        let file = std::fs::File::open(path).map_err(SourceError::Io)?;
        let mut reader = std::io::BufReader::new(file);
        self.parse_reader_with_stats(&mut reader)
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

    // Lookahead is prepared on the selected branch before sequential application.
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
    let mut state = ReconstructionState::new(id, working_directory, source);

    for entry_index in &selected {
        match interpret::interpret(
            &entries[*entry_index],
            &state.id,
            state.working_directory.as_deref(),
            &branch_positions,
            &tool_invocations,
            &failed_tool_call_ids,
        )? {
            interpret::SelectedEntry::Assistant { item, call } => {
                let has_thinking = matches!(
                    &item.payload,
                    TokenizationPayload::AssistantMessage { blocks, .. }
                        if blocks.iter().any(|block| matches!(block, AssistantContentBlock::Thinking { .. }))
                );
                let thinking = call
                    .usage
                    .reasoning
                    .filter(|tokens| has_thinking && *tokens > 0)
                    .zip(call.target.model.clone());
                let response_id = item.id.clone();
                state.apply_message(item, Some(call));
                if let Some((tokens, model)) = thinking {
                    state.apply_reported_thinking(&response_id, tokens, model);
                }
            }
            interpret::SelectedEntry::Message(item) => state.apply_message(item, None),
            interpret::SelectedEntry::System(update) => {
                state.apply_system(*update, &entries[*entry_index])
            }
            interpret::SelectedEntry::Compaction {
                item,
                first_kept_position,
                tokens_before,
            } => state.apply_compaction(
                item,
                first_kept_position,
                tokens_before,
                &branch_positions,
                &entries[*entry_index],
            ),
            interpret::SelectedEntry::Ignored => {}
        }
    }
    Ok(state.finish())
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
        ContextItemKind::Thinking => "Thinking".into(),
        ContextItemKind::UnrecordedContext => "Unrecorded request context".into(),
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

pub(crate) fn first_nonempty_line(text: &str) -> Option<String> {
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
    format!("{display_name} result · {argument}")
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

pub(crate) fn display_path_argument(path: &str, working_directory: Option<&str>) -> String {
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

pub(crate) fn has_visible_label_text(value: &str) -> bool {
    value
        .chars()
        .any(|character| !character.is_whitespace() && !is_unsafe_label_control(character))
}

pub(crate) fn bounded_label(value: &str) -> String {
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
    ImageDescriptor::from_encoded(
        value
            .get("mimeType")
            .or_else(|| value.get("media_type"))
            .and_then(Value::as_str),
        value.get("data").and_then(Value::as_str),
    )
}

fn parse_safe_u64(value: Option<&Value>, field: &'static str) -> Result<Option<u64>, SourceError> {
    let Some(value) = value else {
        return Ok(None);
    };
    if let Some(number) = value.as_u64() {
        if number > crate::domain::MAX_SAFE_JSON_INTEGER {
            return Err(SourceError::UnsafeInteger { field });
        }
        return Ok(Some(number));
    }
    if value.as_f64().is_some_and(|number| {
        number.is_finite() && number > crate::domain::MAX_SAFE_JSON_INTEGER as f64
    }) {
        return Err(SourceError::UnsafeInteger { field });
    }
    Ok(None)
}

fn parse_assistant_usage(message: &Value) -> Result<ReportedUsage, SourceError> {
    let usage = parse_usage(message.get("usage"))?;
    // Pi initializes every core counter and cost component to zero before
    // streaming. A failed/aborted all-zero record is not evidence that the
    // provider measured zero consumption, even if partial content was saved.
    let unsuccessful = matches!(
        message.get("stopReason").and_then(Value::as_str),
        Some("error" | "aborted")
    );
    let default_counters = [
        usage.input,
        usage.output,
        usage.cache_read,
        usage.cache_write,
        usage.total_tokens,
    ]
    .iter()
    .all(|value| *value == Some(0));
    let default_breakdowns = [usage.cache_write_1h, usage.reasoning]
        .iter()
        .all(|value| value.is_none_or(|value| value == 0));
    let default_cost = [
        usage.cost.input,
        usage.cost.output,
        usage.cost.cache_read,
        usage.cost.cache_write,
        usage.cost.total,
    ]
    .iter()
    .all(|value| value.is_none_or(|value| value == 0.0));
    if unsuccessful && default_counters && default_breakdowns && default_cost {
        Ok(ReportedUsage {
            placeholder: Some(PlaceholderUsage {
                cache_write_1h: usage.cache_write_1h,
                reasoning: usage.reasoning,
                cost: usage.cost,
            }),
            output_reasoning_relationship: usage.output_reasoning_relationship,
            ..ReportedUsage::default()
        })
    } else {
        Ok(usage)
    }
}

fn parse_usage(value: Option<&Value>) -> Result<ReportedUsage, SourceError> {
    let Some(usage) = value else {
        return Ok(ReportedUsage::default());
    };
    let cost = usage.get("cost");
    let output = parse_safe_u64(usage.get("output"), "usage.output")?;
    Ok(ReportedUsage {
        placeholder: None,
        input: parse_safe_u64(usage.get("input"), "usage.input")?,
        output,
        recorded_output: output,
        // Pi's normalized usage output already includes reasoning; keep the
        // stored counter and never add an optional reasoning breakdown again.
        output_reasoning_relationship: OutputReasoningRelationship::IncludesReasoning,
        cache_read: parse_safe_u64(usage.get("cacheRead"), "usage.cacheRead")?,
        cache_write: parse_safe_u64(usage.get("cacheWrite"), "usage.cacheWrite")?,
        cache_write_1h: parse_safe_u64(usage.get("cacheWrite1h"), "usage.cacheWrite1h")?,
        reasoning: parse_safe_u64(usage.get("reasoning"), "usage.reasoning")?,
        total_tokens: parse_safe_u64(usage.get("totalTokens"), "usage.totalTokens")?,
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
    })
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

use std::collections::BTreeMap;

#[cfg(test)]
mod tests;
