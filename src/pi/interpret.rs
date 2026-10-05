use super::*;

/// Permissive source interpretation stops here: reconstruction consumes domain
/// values, not arbitrary JSON. Unknown optional records remain ignored.
pub(super) enum SelectedEntry {
    Assistant {
        item: NormalizedContextItem,
        call: Box<AssistantCall>,
    },
    Message(NormalizedContextItem),
    Compaction {
        item: NormalizedContextItem,
        first_kept_position: Option<usize>,
        tokens_before: Option<u64>,
    },
    Ignored,
}

pub(super) struct AssistantCall {
    pub target: ModelTarget,
    pub usage: ReportedUsage,
    pub stop_reason: Option<String>,
    pub timestamps: CallTimestamps,
    pub tools: Vec<NormalizedToolCall>,
}

fn context_item(
    entry: &PiEntry,
    id: String,
    kind: ContextItemKind,
    label: String,
    payload: TokenizationPayload,
) -> NormalizedContextItem {
    NormalizedContextItem {
        id,
        kind,
        label,
        payload,
        source_record_id: Some(entry.id.clone()),
        source_tool_call_id: None,
        metadata: BTreeMap::new(),
        serialized_size_bytes: entry.source_bytes,
        presence: Vec::new(),
        first_model_call: 0,
        last_model_call: 0,
    }
}

pub(super) fn interpret(
    entry: &PiEntry,
    session_id: &str,
    working_directory: Option<&str>,
    branch_positions: &HashMap<&str, usize>,
    invocations: &HashMap<&str, Vec<ToolInvocation<'_>>>,
    failed: &HashSet<String>,
) -> Result<SelectedEntry, SourceError> {
    if entry.kind == "compaction" {
        let summary = entry.value.get("summary").and_then(Value::as_str).ok_or(
            SourceError::RequiredField {
                field: "compaction.summary",
            },
        )?;
        let first_kept = entry.value.get("firstKeptEntryId").and_then(Value::as_str);
        let first_kept_position = first_kept
            .map(|key| {
                branch_positions.get(key).copied().ok_or_else(|| {
                    SourceError::InvalidStructure(format!(
                        "compaction {} references unknown firstKeptEntryId {}",
                        entry.id, key
                    ))
                })
            })
            .transpose()?;
        return Ok(SelectedEntry::Compaction {
            item: context_item(
                entry,
                format!("pi:{session_id}:compaction:{}", entry.id),
                ContextItemKind::CompactionSummary,
                "Compaction summary".into(),
                TokenizationPayload::CompactionSummary(summary.to_owned()),
            ),
            first_kept_position,
            tokens_before: parse_safe_u64(
                entry.value.get("tokensBefore"),
                "compaction.tokensBefore",
            )?,
        });
    }
    // Pi command-shaped records have never entered the supported message path.
    // Ignoring them does not remove source-neutral CommandExecution capability.
    if !matches!(
        entry.kind.as_str(),
        "message" | "custom_message" | "branch_summary"
    ) {
        return Ok(SelectedEntry::Ignored);
    }
    let message_value = message(entry);
    let role = message_value
        .and_then(|message| message.get("role"))
        .and_then(Value::as_str)
        .unwrap_or(match entry.kind.as_str() {
            "custom_message" => "customMessage",
            "branch_summary" => "branchSummary",
            other => other,
        });
    let id = format!("pi:{session_id}:entry:{}", entry.id);
    if role == "assistant" {
        let value = message_value.ok_or(SourceError::RequiredField {
            field: "assistant.message",
        })?;
        let target = ModelTarget {
            provider: value
                .get("provider")
                .and_then(Value::as_str)
                .map(str::to_owned),
            model: value
                .get("model")
                .and_then(Value::as_str)
                .map(str::to_owned),
            api: value.get("api").and_then(Value::as_str).map(str::to_owned),
        };
        let call = AssistantCall {
            timestamps: CallTimestamps {
                started_at_ms: value.get("timestamp").and_then(Value::as_i64).filter(|ms| {
                    ms.unsigned_abs() <= MAX_SAFE_JSON_INTEGER
                        && chrono::DateTime::from_timestamp_millis(*ms).is_some()
                }),
                recorded_at_ms: entry
                    .value
                    .get("timestamp")
                    .and_then(Value::as_str)
                    .and_then(|text| chrono::DateTime::parse_from_rfc3339(text).ok())
                    .map(|time| time.timestamp_millis())
                    .filter(|ms| ms.unsigned_abs() <= MAX_SAFE_JSON_INTEGER),
            },
            usage: parse_usage(value.get("usage"))?,
            stop_reason: value
                .get("stopReason")
                .and_then(Value::as_str)
                .map(str::to_owned),
            tools: assistant_tool_calls(value, failed),
            target: target.clone(),
        };
        let payload = if has_content(value) {
            TokenizationPayload::AssistantMessage {
                blocks: assistant_blocks(value),
                source_provider: target.provider,
                source_model: target.model,
                source_api: target.api,
            }
        } else {
            TokenizationPayload::Unavailable
        };
        return Ok(SelectedEntry::Assistant {
            item: context_item(
                entry,
                id,
                ContextItemKind::AssistantMessage,
                item_label(
                    ContextItemKind::AssistantMessage,
                    Some(value),
                    invocations,
                    working_directory,
                ),
                payload,
            ),
            call: Box::new(call),
        });
    }
    let kind = match role {
        "system" => ContextItemKind::System,
        "tool" | "toolResult" => ContextItemKind::ToolResult,
        "toolDefinition" => ContextItemKind::ToolDefinition,
        "user" => ContextItemKind::UserMessage,
        "custom_message" | "customMessage" => ContextItemKind::CustomMessage,
        "branch_summary" | "branchSummary" => ContextItemKind::BranchSummary,
        _ => ContextItemKind::Other,
    };
    let value = message_value.unwrap_or(&entry.value);
    let payload = match kind {
        ContextItemKind::ToolResult if has_content(value) => TokenizationPayload::ToolResult {
            tool_call_id: value
                .get("toolCallId")
                .and_then(Value::as_str)
                .unwrap_or("")
                .into(),
            tool_name: value
                .get("toolName")
                .and_then(Value::as_str)
                .unwrap_or("unknown")
                .into(),
            content: message_content(Some(value)),
            is_error: value
                .get("isError")
                .and_then(Value::as_bool)
                .unwrap_or(false),
        },
        ContextItemKind::UserMessage if has_content(value) => {
            TokenizationPayload::UserMessage(message_content(Some(value)))
        }
        ContextItemKind::CustomMessage
        | ContextItemKind::System
        | ContextItemKind::ToolDefinition
            if has_content(value) =>
        {
            TokenizationPayload::CustomMessage(message_content(Some(value)))
        }
        ContextItemKind::BranchSummary => entry
            .value
            .get("summary")
            .and_then(Value::as_str)
            .map_or(TokenizationPayload::Unavailable, |summary| {
                TokenizationPayload::BranchSummary(summary.to_owned())
            }),
        _ => TokenizationPayload::Unavailable,
    };
    let mut item = context_item(
        entry,
        id,
        kind,
        item_label(kind, message_value, invocations, working_directory),
        payload,
    );
    item.source_tool_call_id = value
        .get("toolCallId")
        .and_then(Value::as_str)
        .map(str::to_owned);
    if let Some(name) = value.get("toolName").and_then(Value::as_str) {
        item.metadata.insert("toolName".into(), name.into());
    }
    if let Some(is_error) = value.get("isError").and_then(Value::as_bool) {
        item.metadata.insert("isError".into(), is_error.to_string());
    }
    Ok(SelectedEntry::Message(item))
}
