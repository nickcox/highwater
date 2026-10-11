//! Logical conversation replay, not exact provider wire reconstruction.
//! Limitations are returned alongside the normalized session; callers must expose
//! them rather than discarding them when this source is integrated into the UI.

use super::{
    storage::{Generation, MessageRecord, SessionSnapshot},
    usage::{self, OutputAccounting},
};
use crate::domain::*;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet, HashMap};
use thiserror::Error;

mod modern;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) enum ReplayLimitation {
    MissingHistoricalSystemPrompt,
    MissingHistoricalToolDefinitions,
    UnrecordedRequestTransforms,
    UnknownOutputAccounting,
    UnknownCompactionPrompt,
    UnpairedCompactionSummary,
    AmbiguousPruningBoundary,
    UnsupportedContent,
    StorageGenerationSelection,
    AggregatedCompactionUsage,
    MissingCompactionUsage,
    ProjectedRequestBoundaries,
}

impl ReplayLimitation {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::MissingHistoricalSystemPrompt => "missingHistoricalSystemPrompt",
            Self::MissingHistoricalToolDefinitions => "missingHistoricalToolDefinitions",
            Self::UnrecordedRequestTransforms => "unrecordedRequestTransforms",
            Self::UnknownOutputAccounting => "unknownOutputAccounting",
            Self::UnknownCompactionPrompt => "unknownCompactionPrompt",
            Self::UnpairedCompactionSummary => "unpairedCompactionSummary",
            Self::AmbiguousPruningBoundary => "ambiguousPruningBoundary",
            Self::UnsupportedContent => "unsupportedContent",
            Self::StorageGenerationSelection => "storageGenerationSelection",
            Self::AggregatedCompactionUsage => "aggregatedCompactionUsage",
            Self::MissingCompactionUsage => "missingCompactionUsage",
            Self::ProjectedRequestBoundaries => "projectedRequestBoundaries",
        }
    }
}

#[derive(Debug)]
pub(crate) struct ReplayResult {
    pub session: NormalizedSession,
    pub limitations: BTreeSet<ReplayLimitation>,
}

#[derive(Debug, Error)]
pub(crate) enum ReplayError {
    #[error("opencode conversation contains invalid records")]
    InvalidRecords,
    #[error("opencode conversation uses unsupported replay semantics")]
    UnsupportedHistory,
    #[error("opencode usage is invalid")]
    Usage(#[from] usage::InvalidUsage),
}

struct ActiveItem {
    original: usize,
    pruned: Option<(i64, usize)>,
}

struct State {
    session: NormalizedSession,
    active: Vec<ActiveItem>,
    limitations: BTreeSet<ReplayLimitation>,
    pending_compaction: Option<String>,
}

fn text<'a>(value: &'a Value, key: &str) -> Result<&'a str, ReplayError> {
    value
        .get(key)
        .and_then(Value::as_str)
        .ok_or(ReplayError::InvalidRecords)
}

fn nonempty<'a>(value: &'a Value, key: &str) -> Result<&'a str, ReplayError> {
    let value = text(value, key)?;
    if value.is_empty() {
        return Err(ReplayError::InvalidRecords);
    }
    Ok(value)
}

/// An explicit policy (used by reference tests) wins; otherwise each record's
/// stored total decides, and a record without that evidence stays Unknown.
pub(super) fn record_accounting(
    policy: OutputAccounting,
    tokens: Option<&Value>,
    evidence: Option<&Value>,
) -> OutputAccounting {
    match policy {
        OutputAccounting::Unknown => usage::evident_accounting(tokens, evidence),
        explicit => explicit,
    }
}

fn instant(value: Option<&Value>) -> Option<i64> {
    value
        .and_then(Value::as_i64)
        .filter(|value| value.unsigned_abs() <= MAX_SAFE_JSON_INTEGER)
}

fn item_id(message: &str, part: Option<&str>, role: &str) -> String {
    let mut hash = blake3::Hasher::new_derive_key("TokenPlume OpenCode context item v1");
    for value in [message, part.unwrap_or_default(), role] {
        hash.update(&(value.len() as u64).to_le_bytes());
        hash.update(value.as_bytes());
    }
    format!("oc-{}", hash.finalize().to_hex())
}

impl State {
    fn item(
        &mut self,
        message: &MessageRecord,
        part: Option<&str>,
        role: &str,
        label: &str,
        payload: TokenizationPayload,
        tool: Option<&str>,
    ) -> usize {
        let position = self.session.context_items.len();
        let kind = match &payload {
            TokenizationPayload::UserMessage(_) => ContextItemKind::UserMessage,
            TokenizationPayload::AssistantMessage { .. } => ContextItemKind::AssistantMessage,
            TokenizationPayload::ToolResult { .. } => ContextItemKind::ToolResult,
            TokenizationPayload::CompactionSummary(_) => ContextItemKind::CompactionSummary,
            TokenizationPayload::SystemPrompt { .. } => ContextItemKind::System,
            TokenizationPayload::ToolDefinition { .. } => ContextItemKind::ToolDefinition,
            TokenizationPayload::CustomMessage(_) => ContextItemKind::CustomMessage,
            TokenizationPayload::BranchSummary(_) => ContextItemKind::BranchSummary,
            TokenizationPayload::CommandExecution { .. } | TokenizationPayload::Unavailable => {
                ContextItemKind::Other
            }
        };
        let mut metadata = BTreeMap::from([("sourceMessageId".into(), message.id.clone())]);
        if let Some(seq) = message.sequence {
            metadata.insert("sourceSequence".into(), seq.to_string());
        }
        if let Some(kind) = &message.native_kind {
            metadata.insert("sourceRecordType".into(), kind.clone());
        }
        self.session.context_items.push(NormalizedContextItem {
            id: item_id(&message.id, part, role),
            kind,
            label: label.chars().take(160).collect(),
            source_record_id: Some(part.unwrap_or(&message.id).to_owned()),
            source_tool_call_id: tool.map(str::to_owned),
            metadata,
            // No fake byte weighting: the snapshot retains a separate byte metric.
            serialized_size_bytes: 0,
            payload,
            presence: Vec::new(),
            first_model_call: 0,
            last_model_call: 0,
        });
        position
    }

    fn admit(&mut self, index: usize) {
        self.active.push(ActiveItem {
            original: index,
            pruned: None,
        });
    }

    fn members(&mut self, at: Option<i64>, call_index: usize, input_end: usize) -> Vec<String> {
        let mut result = Vec::with_capacity(input_end);
        for item in &self.active[..input_end] {
            let position = match item.pruned {
                Some((pruned_at, revision)) => match at {
                    Some(at) if at > pruned_at => revision,
                    Some(at) if at < pruned_at => item.original,
                    _ => {
                        self.limitations
                            .insert(ReplayLimitation::AmbiguousPruningBoundary);
                        revision
                    }
                },
                None => item.original,
            };
            let item = &mut self.session.context_items[position];
            if let Some(last) = item
                .presence
                .last_mut()
                .filter(|last| last.end_call.checked_add(1) == Some(call_index))
            {
                last.end_call = call_index;
            } else {
                item.presence.push(PresenceRange {
                    start_call: call_index,
                    end_call: call_index,
                });
            }
            if item.first_model_call == 0 {
                item.first_model_call = call_index;
            }
            item.last_model_call = call_index;
            result.push(item.id.clone());
        }
        result
    }
}

/// Conservative default: output semantics remain unknown unless the caller has
/// audited the actual writer history. Creation version is deliberately not used.
pub(crate) fn reconstruct(
    snapshot: SessionSnapshot,
    accounting: OutputAccounting,
) -> Result<ReplayResult, ReplayError> {
    if snapshot.metadata.revert.is_some() {
        return Err(ReplayError::UnsupportedHistory);
    }
    let mut state = State {
        session: NormalizedSession {
            harness_session_cost: None,
            id: snapshot.metadata.id,
            source: SourceDescriptor {
                kind: "opencode".into(),
                version: match snapshot.generation {
                    Generation::Legacy => "sqlite-message-part-v1",
                    Generation::Modern => "sqlite-session-message-v2",
                }
                .into(),
                cost_basis: CostBasis::SourceModelRates,
            },
            title: Some(snapshot.metadata.title),
            working_directory: Some(snapshot.metadata.directory),
            context_items: Vec::new(),
            model_calls: Vec::new(),
            compactions: Vec::new(),
            lineage: Vec::new(),
        },
        active: Vec::new(),
        limitations: BTreeSet::from([
            ReplayLimitation::MissingHistoricalSystemPrompt,
            ReplayLimitation::MissingHistoricalToolDefinitions,
            ReplayLimitation::UnrecordedRequestTransforms,
        ]),
        pending_compaction: None,
    };
    if snapshot.mixed_layout {
        state
            .limitations
            .insert(ReplayLimitation::StorageGenerationSelection);
    }
    if snapshot.generation == Generation::Modern {
        modern::replay(&mut state, &snapshot.messages, accounting)?;
    } else {
        let mut users = HashMap::new();
        for message in &snapshot.messages {
            match text(&message.data, "role")? {
                "user" => {
                    if users.insert(message.id.as_str(), message).is_some() {
                        return Err(ReplayError::InvalidRecords);
                    }
                    user(&mut state, message)?;
                }
                "assistant" => assistant(&mut state, message, &users, accounting)?,
                _ => return Err(ReplayError::UnsupportedHistory),
            }
        }
    }
    // Qualify only when some call's output/reasoning overlap stayed unverified.
    if state.session.model_calls.iter().any(|call| {
        call.reported_usage
            .reasoning
            .is_some_and(|reasoning| reasoning > 0)
            && call.reported_usage.output_reasoning_relationship
                == OutputReasoningRelationship::Unknown
    }) {
        state
            .limitations
            .insert(ReplayLimitation::UnknownOutputAccounting);
    }
    // The current normalized contract describes input-context items, not all
    // output transcript records. Like Pi, discard output/revisions never reused
    // by a call, except explicitly structural compaction summaries (terminal
    // or superseded before any observed request reused them).
    let summaries = state
        .session
        .compactions
        .iter()
        .map(|event| event.summary_item_id.as_str())
        .collect::<BTreeSet<_>>();
    state
        .session
        .context_items
        .retain(|item| !item.presence.is_empty() || summaries.contains(item.id.as_str()));
    // Terminal overflow can retain a marker which never entered any request.
    // Keep it in source storage, not as a fabricated zero-presence context item.
    let exposed_ids = state
        .session
        .context_items
        .iter()
        .map(|item| item.id.as_str())
        .collect::<BTreeSet<_>>();
    for event in &mut state.session.compactions {
        event
            .retained_item_ids
            .retain(|id| exposed_ids.contains(id.as_str()));
    }
    // Match source-neutral frontend ordering, including adjacent checkpoints
    // that share a recorded-call boundary but have distinct native sequences.
    state.session.compactions.sort_by(|left, right| {
        left.before_model_call
            .cmp(&right.before_model_call)
            .then_with(|| left.id.cmp(&right.id))
    });
    state.session.lineage.sort_by(|left, right| {
        left.to
            .cmp(&right.to)
            .then_with(|| left.from.cmp(&right.from))
            .then_with(|| left.kind.cmp(&right.kind))
    });
    Ok(ReplayResult {
        session: state.session,
        limitations: state.limitations,
    })
}

fn user(state: &mut State, message: &MessageRecord) -> Result<(), ReplayError> {
    let mut parts = Vec::new();
    for part in &message.parts {
        match text(&part.data, "type")? {
            "text" => {
                if part.data.get("ignored").and_then(Value::as_bool) != Some(true) {
                    parts.push(ContentPart::Text(text(&part.data, "text")?.to_owned()));
                }
            }
            "file" => match text(&part.data, "mime")? {
                "text/plain" | "application/x-directory" => {}
                _ => {
                    // Do not resolve live files/URLs as historical attachments.
                    parts.push(ContentPart::Unsupported);
                    state
                        .limitations
                        .insert(ReplayLimitation::UnsupportedContent);
                }
            },
            "compaction" => {
                if part.data.get("tail_start_id").is_some() {
                    return Err(ReplayError::UnsupportedHistory);
                }
                parts.push(ContentPart::Text("What did we do so far?".into()));
            }
            "subtask" => parts.push(ContentPart::Text(
                "The following tool was executed by the user".into(),
            )),
            // Known structural parts are omitted by the legacy serializer.
            "agent" | "snapshot" | "patch" | "retry" | "step-start" | "step-finish" => {}
            _ => {
                state
                    .limitations
                    .insert(ReplayLimitation::UnsupportedContent);
                parts.push(ContentPart::Unsupported);
            }
        }
    }
    if !parts.is_empty() {
        let index = state.item(
            message,
            None,
            "user",
            "User message",
            TokenizationPayload::UserMessage(MessageContent { parts }),
            None,
        );
        state.admit(index);
    }
    Ok(())
}

fn assistant(
    state: &mut State,
    message: &MessageRecord,
    users: &HashMap<&str, &MessageRecord>,
    accounting: OutputAccounting,
) -> Result<(), ReplayError> {
    let parent = nonempty(&message.data, "parentID")?;
    let parent_message = users.get(parent).ok_or(ReplayError::InvalidRecords)?;
    let provider = nonempty(&message.data, "providerID")?;
    let model = nonempty(&message.data, "modelID")?;
    let finishes = message
        .parts
        .iter()
        .filter(|part| part.data.get("type").and_then(Value::as_str) == Some("step-finish"))
        .collect::<Vec<_>>();
    let starts = message
        .parts
        .iter()
        .filter(|part| part.data.get("type").and_then(Value::as_str) == Some("step-start"))
        .count();
    if finishes.len() > 1 || starts > 1 {
        return Err(ReplayError::UnsupportedHistory);
    }
    // v1.4.0 shellImpl and handleSubtask synthesize tool-bearing assistants
    // without model steps; mode is the agent name, not a "shell" discriminator.
    // Without either boundary, these cannot be distinguished safely from an
    // incomplete model attempt. Reject the ambiguous history, not invent a call.
    if starts == 0
        && finishes.is_empty()
        && message
            .parts
            .iter()
            .any(|part| part.data.get("type").and_then(Value::as_str) == Some("tool"))
    {
        return Err(ReplayError::UnsupportedHistory);
    }
    let usage_source = finishes
        .first()
        .map(|part| &part.data)
        .unwrap_or(&message.data);
    let measured = !finishes.is_empty();
    let accounting = record_accounting(
        accounting,
        usage_source.get("tokens"),
        usage_source.get("tokens"),
    );
    let reported_usage = usage::normalize(
        usage_source.get("tokens"),
        usage_source.get("cost"),
        measured,
        accounting,
    )?;
    // Validate the mirrored assistant usage too, but never sum the two copies.
    usage::normalize(
        message.data.get("tokens"),
        message.data.get("cost"),
        false,
        accounting,
    )?;
    let time = message.data.get("time");
    let started_at_ms = instant(time.and_then(|time| time.get("created")));
    let recorded_at_ms = instant(time.and_then(|time| time.get("completed")));
    let summary = message.data.get("summary").and_then(Value::as_bool) == Some(true);
    let has_marker = parent_message
        .parts
        .iter()
        .any(|part| part.data.get("type").and_then(Value::as_str) == Some("compaction"));
    if summary && !has_marker {
        // The audited filter only truncates at a matching compaction user part.
        // A bare summary flag is insufficient evidence of a history reset.
        state
            .limitations
            .insert(ReplayLimitation::UnpairedCompactionSummary);
    }
    let overflow = summary
        && parent_message
            .parts
            .iter()
            .any(|part| part.data.get("overflow").and_then(Value::as_bool) == Some(true));
    let mut input_end = state.active.len();
    if overflow {
        // Audited v1.4.0 compaction: remove the most recent ordinary user turn
        // from summary input if an earlier ordinary user remains. Subsequent
        // recorded replay/continuation messages are admitted independently.
        let ordinary_users = state
            .active
            .iter()
            .enumerate()
            .filter(|(_, item)| {
                let item = &state.session.context_items[item.original];
                item.kind == ContextItemKind::UserMessage
                    && item
                        .metadata
                        .get("sourceMessageId")
                        .and_then(|id| users.get(id.as_str()))
                        .is_some_and(|message| {
                            !message.parts.iter().any(|part| {
                                part.data.get("type").and_then(Value::as_str) == Some("compaction")
                            })
                        })
            })
            .map(|(index, _)| index)
            .collect::<Vec<_>>();
        if ordinary_users.len() > 1 {
            input_end = ordinary_users[ordinary_users.len() - 1];
        }
    }
    let call_index = state.session.model_calls.len() + 1;
    let mut context_item_ids = state.members(started_at_ms, call_index, input_end);
    let summarized_ids = summary.then(|| context_item_ids.clone());
    if summary {
        state
            .limitations
            .insert(ReplayLimitation::UnknownCompactionPrompt);
        // A plugin may replace this prompt; the installed default isn't evidence.
        let index = state.item(
            message,
            None,
            "compaction-prompt",
            "Unrecorded compaction prompt",
            TokenizationPayload::Unavailable,
            None,
        );
        let item = &mut state.session.context_items[index];
        item.presence.push(PresenceRange {
            start_call: call_index,
            end_call: call_index,
        });
        item.first_model_call = call_index;
        item.last_model_call = call_index;
        context_item_ids.push(item.id.clone());
    }
    let mut blocks = Vec::new();
    let mut tool_calls = Vec::new();
    let mut tools = Vec::new();
    for part in &message.parts {
        match text(&part.data, "type")? {
            "text" => blocks.push(AssistantContentBlock::Text(
                text(&part.data, "text")?.to_owned(),
            )),
            "reasoning" => blocks.push(AssistantContentBlock::Thinking {
                text: text(&part.data, "text")?.to_owned(),
                provider_signature: None,
            }),
            "tool" => {
                let call_id = nonempty(&part.data, "callID")?;
                if tool_calls
                    .iter()
                    .any(|call: &NormalizedToolCall| call.id == call_id)
                {
                    return Err(ReplayError::InvalidRecords);
                }
                let name = nonempty(&part.data, "tool")?;
                let tool_state = part
                    .data
                    .get("state")
                    .filter(|value| value.is_object())
                    .ok_or(ReplayError::InvalidRecords)?;
                let status = text(tool_state, "status")?;
                if !matches!(status, "completed" | "error" | "pending" | "running") {
                    return Err(ReplayError::UnsupportedHistory);
                }
                let arguments = tool_state.get("input").ok_or(ReplayError::InvalidRecords)?;
                blocks.push(AssistantContentBlock::ToolCall {
                    id: call_id.into(),
                    name: name.into(),
                    arguments: arguments.to_string(),
                });
                tool_calls.push(NormalizedToolCall {
                    id: call_id.into(),
                    name: name.into(),
                    failed: status != "completed",
                });
                tools.push(part);
            }
            "step-start" | "step-finish" | "patch" | "snapshot" | "retry" | "agent" => {}
            _ => {
                blocks.push(AssistantContentBlock::Unsupported);
                state
                    .limitations
                    .insert(ReplayLimitation::UnsupportedContent);
            }
        }
    }
    let stop_reason = message
        .data
        .get("finish")
        .and_then(Value::as_str)
        .map(str::to_owned);
    let successful_summary = summary
        && has_marker
        && stop_reason.is_some()
        && stop_reason.as_deref() != Some("error")
        && message.data.get("error").is_none();
    let error = message.data.get("error");
    let reusable = error.is_none()
        || (error
            .and_then(|error| error.get("name"))
            .and_then(Value::as_str)
            == Some("MessageAbortedError")
            // Match toModelMessages' eligibility test against the source parts,
            // before projection removes structural parts such as step-finish.
            && message.parts.iter().any(|part| {
                !matches!(
                    part.data.get("type").and_then(Value::as_str),
                    Some("step-start" | "reasoning")
                )
            }));
    let call_compaction = state.pending_compaction.take();
    state.session.model_calls.push(NormalizedModelCall {
        tool_loadout_known: false,
        index: call_index,
        source_record_id: message.id.clone(),
        target: ModelTarget {
            provider: Some(provider.into()),
            model: Some(model.into()),
            api: None,
        },
        reported_usage,
        stop_reason,
        timestamps: CallTimestamps {
            started_at_ms,
            recorded_at_ms,
        },
        context_item_ids,
        tool_calls_after: tool_calls,
        compaction_before: call_compaction,
    });
    // The legacy serializer reuses reasoning (and any other assistant blocks)
    // even on summary messages. Keep the plain-text summary payload only when
    // it can represent every block; otherwise use structured assistant content.
    let summary_text = if summary
        && blocks
            .iter()
            .all(|block| matches!(block, AssistantContentBlock::Text(_)))
    {
        Some(
            blocks
                .iter()
                .filter_map(|block| match block {
                    AssistantContentBlock::Text(text) => Some(text.as_str()),
                    _ => None,
                })
                .collect::<Vec<_>>()
                .join("\n"),
        )
    } else {
        None
    };
    let output = if !blocks.is_empty() {
        let index = state.item(
            message,
            None,
            "assistant",
            if summary {
                "Compaction summary"
            } else {
                "Assistant message"
            },
            match summary_text {
                Some(text) => TokenizationPayload::CompactionSummary(text),
                None => TokenizationPayload::AssistantMessage {
                    blocks,
                    source_provider: Some(provider.into()),
                    source_model: Some(model.into()),
                    source_api: None,
                },
            },
            None,
        );
        if summary {
            // Structural identity and lineage are independent of payload shape.
            state.session.context_items[index].kind = ContextItemKind::CompactionSummary;
        }
        Some(index)
    } else {
        None
    };
    if successful_summary {
        let summary_index = output.ok_or(ReplayError::InvalidRecords)?;
        let summary_id = state.session.context_items[summary_index].id.clone();
        let marker_positions = state
            .active
            .iter()
            .filter(|item| {
                state.session.context_items[item.original]
                    .metadata
                    .get("sourceMessageId")
                    .map(String::as_str)
                    == Some(parent)
            })
            .map(|item| item.original)
            .collect::<BTreeSet<_>>();
        let marker_ids = marker_positions
            .iter()
            .map(|position| state.session.context_items[*position].id.as_str())
            .collect::<BTreeSet<_>>();
        let source_item_ids = summarized_ids
            .ok_or(ReplayError::InvalidRecords)?
            .into_iter()
            .filter(|id| !marker_ids.contains(id.as_str()))
            .collect::<Vec<_>>();
        state
            .active
            .retain(|item| marker_positions.contains(&item.original));
        let retained_item_ids = state
            .active
            .iter()
            .map(|item| state.session.context_items[item.original].id.clone())
            .collect();
        let id = item_id(&message.id, None, "compaction");
        for source in &source_item_ids {
            state.session.lineage.push(NormalizedLineageEdge {
                from: source.clone(),
                to: summary_id.clone(),
                kind: "frameworkCompaction".into(),
            });
        }
        state.session.compactions.push(NormalizedCompaction {
            id: id.clone(),
            before_model_call: call_index + 1,
            source_item_ids,
            retained_item_ids,
            summary_item_id: summary_id,
            tokens_before: None,
        });
        state.pending_compaction = Some(id);
        state.admit(summary_index);
    } else if reusable {
        if let Some(output) = output {
            state.admit(output);
        }
    }
    if reusable && !summary {
        for part in tools {
            let tool_state = &part.data["state"];
            let status = text(tool_state, "status")?;
            let call_id = nonempty(&part.data, "callID")?;
            let name = nonempty(&part.data, "tool")?;
            let output = match status {
                "completed" => text(tool_state, "output")?,
                "error" => text(tool_state, "error")?,
                _ => "[Tool execution was interrupted]",
            };
            let has_attachments = tool_state
                .get("attachments")
                .and_then(Value::as_array)
                .is_some_and(|value| !value.is_empty());
            let mut content = MessageContent::text(output);
            if has_attachments {
                content.parts.push(ContentPart::Unsupported);
                state
                    .limitations
                    .insert(ReplayLimitation::UnsupportedContent);
            }
            let result = state.item(
                message,
                Some(&part.id),
                "tool-result",
                &format!("{name} result"),
                TokenizationPayload::ToolResult {
                    tool_call_id: call_id.into(),
                    tool_name: name.into(),
                    content,
                    is_error: status != "completed",
                },
                Some(call_id),
            );
            let compacted = tool_state
                .get("time")
                .and_then(|time| time.get("compacted"));
            let pruned = if let Some(compacted) = compacted {
                let at = instant(Some(compacted)).ok_or(ReplayError::InvalidRecords)?;
                let revision = state.item(
                    message,
                    Some(&part.id),
                    "tool-result-pruned",
                    &format!("{name} result · cleared"),
                    TokenizationPayload::ToolResult {
                        tool_call_id: call_id.into(),
                        tool_name: name.into(),
                        content: MessageContent::text("[Old tool result content cleared]"),
                        is_error: false,
                    },
                    Some(call_id),
                );
                Some((at, revision))
            } else {
                None
            };
            state.active.push(ActiveItem {
                original: result,
                pruned,
            });
        }
    }
    Ok(())
}
