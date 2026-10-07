#[path = "interpret.rs"]
mod interpret;
#[path = "state.rs"]
mod state;
#[path = "system_context.rs"]
mod system_context;
#[cfg(test)]
#[path = "system_context_tests.rs"]
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
                state.apply_message(item, Some(call))
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
        encoded_data_length: value
            .get("data")
            .and_then(Value::as_str)
            .map(|data| data.len() as u64),
    }
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

fn parse_usage(value: Option<&Value>) -> Result<ReportedUsage, SourceError> {
    let Some(usage) = value else {
        return Ok(ReportedUsage::default());
    };
    let cost = usage.get("cost");
    Ok(ReportedUsage {
        input: parse_safe_u64(usage.get("input"), "usage.input")?,
        output: parse_safe_u64(usage.get("output"), "usage.output")?,
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
    fn source_base64_length_is_encoded_size_not_decoded_image_size() {
        let session = parse_records(&[
            serde_json::json!({"type": "session", "id": "encoded", "version": 3}),
            message_record(
                "image",
                None,
                serde_json::json!({"role": "user", "content": [{"type": "image", "mimeType": "image/png", "data": "aGVsbG8="}]}),
            ),
            message_record(
                "call",
                Some("image"),
                serde_json::json!({"role": "assistant", "content": [{"type": "text", "text": "seen"}]}),
            ),
        ]);
        let item = &session.context_items[0];
        let TokenizationPayload::UserMessage(content) = &item.payload else {
            panic!("user payload");
        };
        let ContentPart::Image(image) = &content.parts[0] else {
            panic!("image metadata");
        };
        assert_eq!(image.encoded_data_length, Some(8)); // Encoded "hello", not its five decoded bytes.
        let analysis = crate::analysis::analyze(
            session,
            crate::analysis::AnalysisConfig {
                tokenization: crate::analysis::TokenizationPolicy::Heuristic,
                perf_diagnostics: false,
            },
        )
        .expect("image analysis");
        let preview = analysis.context_items[0].preview.as_ref().expect("preview");
        assert_eq!(preview.text, "[image: image/png, 8.0 B encoded]");
        assert_eq!(preview.expanded_text, preview.text);
        assert_eq!(
            analysis.context_items[0].token_estimates[0].coverage,
            "partial"
        );
    }

    #[test]
    fn assistant_wall_clock_instants_are_normalized_independently() {
        let mut response = message_record(
            "a",
            None,
            serde_json::json!({
                "role":"assistant", "api":"openai-codex-responses", "stopReason":"stop",
                "timestamp":1700000000000_i64, "content":[], "usage":{"output":100}
            }),
        );
        response["timestamp"] = serde_json::json!("2023-11-15T00:13:22+02:00");
        let header = serde_json::json!({"type":"session","id":"timed","version":3});
        let session = parse_records(&[header.clone(), response.clone()]);
        assert_eq!(
            session.model_calls[0].timestamps,
            CallTimestamps {
                started_at_ms: Some(1700000000000),
                recorded_at_ms: Some(1700000002000)
            }
        );
        // Malformed optional metadata must not reject otherwise usable sessions,
        // and a missing/invalid start must not discard a valid recording instant.
        for value in [
            serde_json::json!("invalid"),
            serde_json::json!(1.5),
            serde_json::json!(i64::MAX),
            Value::Null,
        ] {
            response["message"]["timestamp"] = value;
            let session = parse_records(&[header.clone(), response.clone()]);
            assert_eq!(session.model_calls[0].timestamps.started_at_ms, None);
            assert_eq!(
                session.model_calls[0].timestamps.recorded_at_ms,
                Some(1700000002000)
            );
        }
        response["message"]["timestamp"] = serde_json::json!(0);
        response["timestamp"] = serde_json::json!("invalid");
        let session = parse_records(&[header, response]);
        assert_eq!(session.model_calls[0].timestamps.started_at_ms, Some(0));
        assert_eq!(session.model_calls[0].timestamps.recorded_at_ms, None);
    }

    #[test]
    fn normalized_fixture_parity() {
        let mut digest = blake3::Hasher::new();
        let mut legacy_digest = blake3::Hasher::new();
        for name in [
            "aborted-assistant",
            "branch",
            "compaction-metadata",
            "compaction",
            "context-entry-kinds",
            "economics-policies",
            "errored-assistant",
            "failed-tool",
            "multiple-compactions",
            "simple",
            "terminal-compaction",
            "tools",
        ] {
            let normalized = format!("{:?}", fixture(name));
            digest.update(normalized.as_bytes());
            legacy_digest.update(
                normalized
                    .replace("tool_loadout_known: false, ", "")
                    .as_bytes(),
            );
        }
        assert_eq!(
            legacy_digest.finalize().to_hex().as_str(),
            "7a6f8e5e21caef161601aba4110f024810988069086eaec2458079f6d15e76a1"
        );
        assert_eq!(
            digest.finalize().to_hex().as_str(),
            // Only the internal loadout-knowledge flag changes these older fixtures.
            "d7ab15e0f00da6950219c6047bef9e717c92c34d14276bc578ebd757234a741b"
        );
    }

    #[test]
    fn reader_and_path_stats_share_reconstruction() {
        let reader_session = fixture("simple");
        let (path_session, stats) = PiSourceAdapter
            .parse_path_with_stats(Path::new("fixtures/pi/simple.jsonl"))
            .expect("path fixture");
        assert!(stats.entries >= stats.selected_entries);
        assert_eq!(reader_session.id, path_session.id);
        assert_eq!(
            reader_session.model_calls.len(),
            path_session.model_calls.len()
        );
        assert_eq!(
            reader_session
                .model_calls
                .iter()
                .map(|call| &call.context_item_ids)
                .collect::<Vec<_>>(),
            path_session
                .model_calls
                .iter()
                .map(|call| &call.context_item_ids)
                .collect::<Vec<_>>()
        );
        assert_eq!(
            reader_session.context_items.len(),
            path_session.context_items.len()
        );
        assert_eq!(
            reader_session.compactions.len(),
            path_session.compactions.len()
        );
    }

    #[test]
    fn consecutive_compactions_keep_stable_indexes_and_defer_response_filtering() {
        let session = parse_records(&[
            message_record(
                "u1",
                None,
                serde_json::json!({"role":"user","content":"first"}),
            ),
            message_record(
                "a1",
                Some("u1"),
                serde_json::json!({"role":"assistant","content":"first answer"}),
            ),
            message_record(
                "u2",
                Some("a1"),
                serde_json::json!({"role":"user","content":"retained"}),
            ),
            serde_json::json!({"type":"compaction","id":"c1","parentId":"u2","summary":"first summary","firstKeptEntryId":"u2"}),
            serde_json::json!({"type":"compaction","id":"c2","parentId":"c1","summary":"second summary","firstKeptEntryId":"u2"}),
            message_record(
                "a2",
                Some("c2"),
                serde_json::json!({"role":"assistant","content":"second answer"}),
            ),
            message_record(
                "a3",
                Some("a2"),
                serde_json::json!({"role":"assistant","content":"last answer"}),
            ),
        ]);
        assert_eq!(suffixes(&session, 1), vec!["u1"]);
        // The first summary is newer than the retained-tail boundary, so it
        // remains in that tail under the existing source-local semantics.
        assert_eq!(suffixes(&session, 2), vec!["c2", "c1", "u2"]);
        assert_eq!(suffixes(&session, 3), vec!["c2", "c1", "u2", "a2"]);
        assert_eq!(session.compactions.len(), 2);
        assert!(session.compactions[1].summary_item_id.ends_with(":c2"));
        assert_eq!(session.compactions[1].before_model_call, 2);
        assert!(session.compactions[1]
            .retained_item_ids
            .iter()
            .any(|id| id.ends_with(":c1")));
        let response = session
            .context_items
            .iter()
            .find(|item| item.source_record_id.as_deref() == Some("a2"))
            .expect("response used by next call");
        assert_eq!(response.first_model_call, 3);
        assert_eq!(
            response.presence,
            vec![PresenceRange {
                start_call: 3,
                end_call: 3
            }]
        );
        let summary = session
            .context_items
            .iter()
            .find(|item| item.kind == ContextItemKind::CompactionSummary)
            .expect("current summary");
        assert_eq!(
            summary.presence,
            vec![PresenceRange {
                start_call: 2,
                end_call: 3
            }]
        );
    }

    #[test]
    fn command_shaped_and_unknown_records_remain_ignored() {
        let session = parse_records(&[
            message_record(
                "u1",
                None,
                serde_json::json!({"role":"user","content":"hello"}),
            ),
            serde_json::json!({"type":"command","id":"cmd","parentId":"u1","command":"echo hello","output":"hello","message":{"role":"user","content":"not context"}}),
            message_record(
                "a1",
                Some("cmd"),
                serde_json::json!({"role":"assistant","content":"answer"}),
            ),
            serde_json::json!({"type":"future-event","id":"future","parentId":"a1","content":"ignored"}),
            message_record(
                "a2",
                Some("future"),
                serde_json::json!({"role":"assistant","content":"final"}),
            ),
        ]);
        assert_eq!(suffixes(&session, 1), vec!["u1"]);
        assert_eq!(suffixes(&session, 2), vec!["u1", "a1"]);
        assert!(session
            .context_items
            .iter()
            .all(|item| !matches!(item.payload, TokenizationPayload::CommandExecution { .. })));
    }

    #[test]
    fn failed_tool_lookahead_uses_only_the_selected_branch() {
        let session = parse_records(&[
            message_record(
                "u1",
                None,
                serde_json::json!({"role":"user","content":"run tools"}),
            ),
            message_record(
                "a1",
                Some("u1"),
                serde_json::json!({"role":"assistant","content":[{"type":"toolCall","id":"selected-tool","name":"bash","arguments":{}},{"type":"toolCall","id":"other-tool","name":"bash","arguments":{}}]}),
            ),
            message_record(
                "other-result",
                Some("a1"),
                serde_json::json!({"role":"toolResult","toolCallId":"other-tool","isError":true,"content":"unselected failure"}),
            ),
            message_record(
                "selected-result",
                Some("a1"),
                serde_json::json!({"role":"toolResult","toolCallId":"selected-tool","isError":true,"content":"selected failure"}),
            ),
            message_record(
                "a2",
                Some("selected-result"),
                serde_json::json!({"role":"assistant","content":"done"}),
            ),
        ]);
        assert!(session.model_calls[0].tool_calls_after[0].failed);
        assert!(!session.model_calls[0].tool_calls_after[1].failed);
        assert_eq!(suffixes(&session, 2), vec!["u1", "a1", "selected-result"]);
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
            "Read result · src/analysis/mod.rs"
        );
        assert_eq!(
            item_label_for_record(&session, "r2"),
            "Write result · src/new.rs"
        );
        assert_eq!(
            item_label_for_record(&session, "r3"),
            "Edit result · src/old.rs"
        );
        assert_eq!(
            item_label_for_record(&session, "r4"),
            "Bash result · cargo test --workspace"
        );
        assert_eq!(
            item_label_for_record(&session, "r5"),
            "Grep result · toolCallId"
        );
        assert_eq!(
            item_label_for_record(&session, "r6"),
            "Find result · **/*.rs"
        );
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
        assert_eq!(
            item_label_for_record(&session, "r6"),
            "Read result · src/known.rs"
        );
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
            "Read result · right.rs"
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
        assert!(matches!(error, SourceError::InvalidStructure(_)));
    }

    #[test]
    fn compaction_summary_is_required_but_explicit_empty_is_supported() {
        for summary in [
            None,
            Some(serde_json::Value::Null),
            Some(serde_json::json!(12)),
        ] {
            let mut compaction = serde_json::json!({
                "type": "compaction",
                "id": "c1",
                "parentId": "a1",
                "firstKeptEntryId": "a1",
            });
            if let Some(summary) = summary {
                compaction["summary"] = summary;
            }
            let records = [
                serde_json::json!({"type":"session","id":"summary-required"}),
                message_record(
                    "u1",
                    None,
                    serde_json::json!({"role":"user","content":"start"}),
                ),
                message_record(
                    "a1",
                    Some("u1"),
                    serde_json::json!({"role":"assistant","stopReason":"stop","content":"done"}),
                ),
                compaction,
            ];
            let jsonl = records
                .iter()
                .map(|record| serde_json::to_string(record).expect("JSON record"))
                .collect::<Vec<_>>()
                .join("\n");
            let error = PiSourceAdapter
                .parse(&mut Cursor::new(jsonl))
                .expect_err("missing or invalid summary must fail");
            assert!(matches!(error, SourceError::RequiredField { .. }));
        }

        let session = parse_records(&[
            serde_json::json!({"type":"session","id":"empty-summary"}),
            message_record(
                "u1",
                None,
                serde_json::json!({"role":"user","content":"start"}),
            ),
            message_record(
                "a1",
                Some("u1"),
                serde_json::json!({"role":"assistant","stopReason":"stop","content":"done"}),
            ),
            serde_json::json!({
                "type":"compaction",
                "id":"c1",
                "parentId":"a1",
                "summary":"",
                "firstKeptEntryId":"a1"
            }),
        ]);
        let summary = session
            .context_items
            .iter()
            .find(|item| item.kind == ContextItemKind::CompactionSummary)
            .expect("summary item");
        assert!(matches!(
            summary.payload,
            TokenizationPayload::CompactionSummary(ref text) if text.is_empty()
        ));
    }

    #[test]
    fn selected_source_usage_above_safe_integer_is_rejected() {
        let records = [
            serde_json::json!({"type":"session","id":"numeric"}),
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
                    "stopReason":"stop",
                    "content":"done",
                    "usage":{"input":9007199254740992u64}
                }),
            ),
        ];
        let jsonl = records
            .iter()
            .map(|record| serde_json::to_string(record).expect("JSON record"))
            .collect::<Vec<_>>()
            .join("\n");
        let error = PiSourceAdapter
            .parse(&mut Cursor::new(jsonl))
            .expect_err("unsafe usage must fail");
        assert!(matches!(
            error,
            SourceError::UnsafeInteger {
                field: "usage.input"
            }
        ));
    }
}
