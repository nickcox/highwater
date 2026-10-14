//! Turns a replayed session into model calls and context items. Section 5 of
//! plans/vscode-copilot-implementation-plan.md describes the rules.

use super::{
    traces::{TraceCall, Traces},
    Limitation,
};
use crate::{
    domain::*,
    pi::reconstruct::{bounded_label, display_path_argument, first_nonempty_line},
};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

pub(super) struct Reconstruction {
    pub session: NormalizedSession,
    pub limitations: BTreeSet<Limitation>,
}

struct State<'t> {
    working_directory: Option<String>,
    items: Vec<NormalizedContextItem>,
    item_indexes: HashMap<String, usize>,
    /// Conversation items in context for the next call, in order.
    active: Vec<usize>,
    calls: Vec<NormalizedModelCall>,
    limitations: BTreeSet<Limitation>,
    traces: Option<&'t Traces>,
    /// Trace calls already matched to a request, by span ID.
    claimed: HashSet<&'t str>,
    /// The latest system prompt item recorded for each model. A Responses API call that
    /// continues an earlier response does not repeat the instructions it was given.
    systems: HashMap<Option<String>, usize>,
    /// The conversation summary in effect, from the latest compaction.
    summary: Option<String>,
    compactions: Vec<NormalizedCompaction>,
}

pub(super) fn reconstruct(
    session: &Value,
    working_directory: Option<String>,
    traces: Option<&Traces>,
) -> Result<Reconstruction, SourceError> {
    let id =
        text(session.get("sessionId")).ok_or(SourceError::RequiredField { field: "sessionId" })?;
    let requests = array(session.get("requests"));
    let version = requests
        .iter()
        .find_map(|request| text(request.pointer("/agent/extensionVersion")))
        .unwrap_or_else(|| "unknown".into());
    let mut state = State {
        working_directory,
        items: Vec::new(),
        item_indexes: HashMap::new(),
        active: Vec::new(),
        calls: Vec::new(),
        limitations: [Limitation::UnrecordedHarnessCalls].into(),
        traces,
        claimed: HashSet::new(),
        systems: HashMap::new(),
        summary: None,
        compactions: Vec::new(),
    };
    // Trace calls that name a request's response belong to that request.
    if let Some(traces) = traces {
        let responses: HashSet<&str> = requests
            .iter()
            .filter_map(|request| request.pointer("/result/metadata/responseId")?.as_str())
            .collect();
        state.claimed = traces
            .calls
            .iter()
            .filter(|call| {
                call.response_id
                    .as_deref()
                    .is_some_and(|id| responses.contains(id))
            })
            .map(|call| call.span_id.as_str())
            .collect();
    }
    for (position, request) in requests.iter().enumerate() {
        let window_end = requests
            .get(position + 1)
            .and_then(|next| next.get("timestamp"))
            .and_then(Value::as_i64);
        state.apply_request(request, position, window_end)?;
    }
    if state.calls.iter().any(|call| !call.tool_loadout_known) {
        state
            .limitations
            .insert(Limitation::MissingHistoricalSystemPrompt);
        state
            .limitations
            .insert(Limitation::MissingHistoricalToolDefinitions);
    }
    let working_directory = state.working_directory.clone();
    Ok(Reconstruction {
        limitations: std::mem::take(&mut state.limitations),
        session: state.finish(
            id,
            text(session.get("customTitle")),
            working_directory,
            SourceDescriptor {
                kind: "vscode-copilot".into(),
                version,
                cost_basis: CostBasis::Unknown,
            },
        ),
    })
}

/// A non-empty, trimmed string.
fn text(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_owned)
}

fn array(value: Option<&Value>) -> &[Value] {
    value.and_then(Value::as_array).map_or(&[], Vec::as_slice)
}

fn counter(value: Option<&Value>, field: &'static str) -> Result<Option<u64>, SourceError> {
    match value.and_then(Value::as_u64) {
        Some(count) if count > MAX_SAFE_JSON_INTEGER => Err(SourceError::UnsafeInteger { field }),
        count => Ok(count),
    }
}

/// One model call: a round of a request, a request that recorded no rounds, or a call
/// known only from the trace records.
struct Round<'t> {
    id: String,
    model: Option<String>,
    api: Option<String>,
    recorded_at_ms: Option<i64>,
    response: String,
    /// The round's reasoning tokens, as Copilot recorded them with its thinking.
    thinking_tokens: Option<u64>,
    /// `(id, name, arguments)`.
    tool_calls: Vec<(String, String, String)>,
    /// A request without rounds whose response shows tool calls: several model calls
    /// recorded as one.
    combined: bool,
    trace: Option<&'t TraceCall>,
}

/// Copilot adds `__vscode-<number>` to tool-call IDs in the session file; the trace
/// records use the ID without it.
fn base_tool_call_id(id: &str) -> &str {
    id.split_once("__vscode-").map_or(id, |(base, _)| base)
}

/// A request's rounds and trace calls match when there are as many of each and each
/// round made the same tool calls as its trace call.
fn rounds_match(rounds: &[Round<'_>], calls: &[&TraceCall]) -> bool {
    rounds.len() == calls.len()
        && rounds.iter().zip(calls).all(|(round, call)| {
            let recorded: BTreeSet<&str> = round
                .tool_calls
                .iter()
                .map(|(id, ..)| base_tool_call_id(id))
                .collect();
            let traced: BTreeSet<&str> = call
                .tool_calls
                .iter()
                .map(|(id, ..)| base_tool_call_id(id))
                .collect();
            recorded == traced
        })
}

/// A model call known from its trace record, for a request that recorded no rounds.
fn traced_round(call: &TraceCall) -> Round<'_> {
    Round {
        id: call.span_id.clone(),
        model: call.model.clone(),
        api: call.api.clone(),
        recorded_at_ms: Some(call.ended_at_ms),
        response: call.output_text.clone(),
        thinking_tokens: call.reasoning,
        tool_calls: call.tool_calls.clone(),
        combined: false,
        trace: Some(call),
    }
}

/// Usage from a trace record. Its input includes the cached part; OpenAI models report
/// no cache writes.
fn traced_usage(call: &TraceCall) -> ReportedUsage {
    let cache_read = call.cache_read.unwrap_or(0);
    let cache_write = call.cache_write.unwrap_or(0);
    let input = call
        .input
        .and_then(|input| input.checked_sub(cache_read)?.checked_sub(cache_write));
    ReportedUsage {
        input,
        cache_read: input.map(|_| cache_read),
        cache_write: input.map(|_| cache_write),
        output: call.output,
        recorded_output: call.output,
        output_reasoning_relationship: if call.output.is_some() {
            OutputReasoningRelationship::IncludesReasoning
        } else {
            OutputReasoningRelationship::Unknown
        },
        reasoning: call.reasoning,
        ..ReportedUsage::default()
    }
}

impl<'t> State<'t> {
    /// The trace calls of a request: those naming its response, or for a request with no
    /// response ID (one that was stopped), the unclaimed calls between it and the next.
    fn trace_calls(&self, request: &Value, window_end: Option<i64>) -> Vec<&'t TraceCall> {
        let Some(traces) = self.traces else {
            return Vec::new();
        };
        if let Some(response) = request
            .pointer("/result/metadata/responseId")
            .and_then(Value::as_str)
        {
            return traces
                .calls
                .iter()
                .filter(|call| call.response_id.as_deref() == Some(response))
                .collect();
        }
        let Some(start) = request.get("timestamp").and_then(Value::as_i64) else {
            return Vec::new();
        };
        traces
            .calls
            .iter()
            .filter(|call| {
                !self.claimed.contains(call.span_id.as_str())
                    && call.started_at_ms >= start
                    && window_end.is_none_or(|end| call.started_at_ms < end)
            })
            .collect()
    }

    fn apply_request(
        &mut self,
        request: &Value,
        position: usize,
        window_end: Option<i64>,
    ) -> Result<(), SourceError> {
        let request_id = text(request.get("requestId")).unwrap_or_else(|| format!("{position}"));
        let mut rounds = rounds(request, &request_id)?;
        if rounds.is_empty() {
            // A cancelled request with no response never reached a model.
            return Ok(());
        }
        let traced = self.trace_calls(request, window_end);
        if !traced.is_empty() {
            if rounds[0].combined {
                rounds = traced.iter().map(|call| traced_round(call)).collect();
            } else if rounds_match(&rounds, &traced) {
                for (round, call) in rounds.iter_mut().zip(&traced) {
                    round.trace = Some(call);
                }
            } else {
                self.limitations.insert(Limitation::TraceRecordsIncomplete);
            }
        }
        let metadata = request.pointer("/result/metadata");
        if let Some(context) = metadata
            .map(|metadata| rendered(metadata.get("renderedGlobalContext")))
            .filter(|content| !content.parts.is_empty())
        {
            self.insert(NormalizedContextItem {
                id: format!("vscode-copilot:context:{request_id}"),
                kind: ContextItemKind::CustomMessage,
                label: "Workspace context".into(),
                source_record_id: Some(request_id.clone()),
                source_tool_call_id: None,
                metadata: BTreeMap::new(),
                serialized_size_bytes: content_bytes(&context),
                payload: TokenizationPayload::CustomMessage(context),
                presence: Vec::new(),
                first_model_call: 0,
                last_model_call: 0,
            });
        }
        let message = request
            .pointer("/message/text")
            .and_then(Value::as_str)
            .unwrap_or("");
        // The message as sent includes attachments and Copilot's reminders. Without it,
        // only the typed text is known.
        let sent = metadata.map(|metadata| rendered(metadata.get("renderedUserMessage")));
        let content = match sent.filter(|content| !content.parts.is_empty()) {
            Some(content) => content,
            None => {
                if request
                    .pointer("/variableData/variables")
                    .and_then(Value::as_array)
                    .is_some_and(|variables| !variables.is_empty())
                {
                    self.limitations.insert(Limitation::UnrenderedAttachments);
                }
                MessageContent::text(message)
            }
        };
        let label = first_nonempty_line(message).map_or_else(
            || "User message".to_owned(),
            |line| format!("User · {line}"),
        );
        self.insert(NormalizedContextItem {
            id: format!("vscode-copilot:user:{request_id}"),
            kind: ContextItemKind::UserMessage,
            label,
            source_record_id: Some(request_id.clone()),
            source_tool_call_id: None,
            metadata: BTreeMap::new(),
            serialized_size_bytes: content_bytes(&content),
            payload: TokenizationPayload::UserMessage(content),
            presence: Vec::new(),
            first_model_call: 0,
            last_model_call: 0,
        });
        let prompt_tokens = counter(
            request
                .get("promptTokens")
                .or_else(|| metadata.and_then(|metadata| metadata.get("promptTokens"))),
            "promptTokens",
        )?;
        let output_tokens = counter(
            request
                .get("completionTokens")
                .or_else(|| metadata.and_then(|metadata| metadata.get("outputTokens"))),
            "completionTokens",
        )?;
        let results = metadata.and_then(|metadata| metadata.get("toolCallResults"));
        let last = rounds.len() - 1;
        let single = rounds.len() == 1 && !rounds[0].combined;
        if rounds[0].combined {
            self.limitations.insert(Limitation::UnrecordedRounds);
        }
        for (position, round) in rounds.into_iter().enumerate() {
            if let Some(call) = round.trace {
                let usage = traced_usage(call);
                self.apply_round(&request_id, round, usage, results);
                continue;
            }
            // The request's input is its last call's; its output is every call's together,
            // so it is a call's own output only when there is one call.
            let output = if single { output_tokens } else { None };
            let usage = ReportedUsage {
                input_total: if position == last {
                    prompt_tokens
                } else {
                    None
                },
                output,
                recorded_output: output,
                output_reasoning_relationship: if output.is_some() {
                    OutputReasoningRelationship::IncludesReasoning
                } else {
                    OutputReasoningRelationship::Unknown
                },
                reasoning: round.thinking_tokens,
                ..ReportedUsage::default()
            };
            self.apply_round(&request_id, round, usage, results);
        }
        Ok(())
    }

    /// The system prompt and tool definition items a traced call recorded, and whether
    /// both were recorded.
    fn loadout(&mut self, call: &TraceCall) -> (Vec<usize>, bool) {
        let system = match &call.system {
            Some(text) => {
                let index = self.loadout_item(
                    format!("vscode-copilot:system:{}", short_hash(text)),
                    ContextItemKind::System,
                    "System prompt".into(),
                    BTreeMap::new(),
                    TokenizationPayload::SystemPrompt {
                        text: text.clone(),
                        complete: true,
                    },
                );
                self.systems.insert(call.model.clone(), index);
                Some(index)
            }
            None => self.systems.get(&call.model).copied(),
        };
        let mut loadout: Vec<usize> = system.into_iter().collect();
        if let Some(tools) = &call.tools {
            // Copilot sends Claude only the tools before `tool_search` in full. The ones after
            // it are deferred: the model loads them through `tool_search` when it needs them.
            let sent = match tools.iter().position(|(name, _)| name == "tool_search") {
                Some(position) if call.api.as_deref() == Some("anthropic-messages") => {
                    &tools[..=position]
                }
                _ => &tools[..],
            };
            for (name, definition) in sent {
                loadout.push(self.loadout_item(
                    format!(
                        "vscode-copilot:tool-definition:{name}:{}",
                        short_hash(definition)
                    ),
                    ContextItemKind::ToolDefinition,
                    format!("{} definition", bounded_label(name)),
                    BTreeMap::from([("toolName".into(), name.clone())]),
                    TokenizationPayload::ToolDefinition {
                        text: definition.clone(),
                        complete: true,
                    },
                ));
            }
        }
        (loadout, system.is_some() && call.tools.is_some())
    }

    /// The same text is the same item for every call that recorded it.
    fn loadout_item(
        &mut self,
        id: String,
        kind: ContextItemKind,
        label: String,
        metadata: BTreeMap<String, String>,
        payload: TokenizationPayload,
    ) -> usize {
        if let Some(index) = self.item_indexes.get(&id) {
            return *index;
        }
        let bytes = match &payload {
            TokenizationPayload::SystemPrompt { text, .. }
            | TokenizationPayload::ToolDefinition { text, .. } => byte_length(text),
            _ => 0,
        };
        let index = self.items.len();
        self.item_indexes.insert(id.clone(), index);
        self.items.push(NormalizedContextItem {
            id,
            kind,
            label,
            source_record_id: None,
            source_tool_call_id: None,
            metadata,
            serialized_size_bytes: bytes,
            payload,
            presence: Vec::new(),
            first_model_call: 0,
            last_model_call: 0,
        });
        index
    }

    fn apply_round(
        &mut self,
        request_id: &str,
        round: Round<'t>,
        usage: ReportedUsage,
        results: Option<&Value>,
    ) {
        let index = self.calls.len() + 1;
        let compaction_before = round.trace.and_then(|call| {
            let summary = call.summary.as_ref()?;
            (self.summary.as_ref() != Some(summary)).then(|| self.compact(summary, call, index))
        });
        let (loadout, loadout_known) = match round.trace {
            Some(call) => self.loadout(call),
            None => (Vec::new(), false),
        };
        let in_context: Vec<usize> = loadout.iter().chain(&self.active).copied().collect();
        let context_item_ids = in_context
            .iter()
            .map(|item| self.items[*item].id.clone())
            .collect();
        for item in in_context {
            extend_presence(&mut self.items[item], index);
        }
        let mut blocks = Vec::new();
        if !round.response.is_empty() {
            blocks.push(AssistantContentBlock::Text(round.response.clone()));
        }
        let mut tool_calls_after = Vec::new();
        let mut tools = Vec::new();
        for (id, name, arguments) in round.tool_calls {
            blocks.push(AssistantContentBlock::ToolCall {
                id: id.clone(),
                name: name.clone(),
                arguments: arguments.clone(),
            });
            tool_calls_after.push(NormalizedToolCall {
                id: id.clone(),
                name: name.clone(),
                failed: false,
            });
            tools.push((id, name, arguments));
        }
        self.calls.push(NormalizedModelCall {
            tool_loadout_known: loadout_known,
            index,
            source_record_id: format!("{request_id}:{}", round.id),
            target: ModelTarget {
                provider: Some("github-copilot".into()),
                model: round
                    .trace
                    .and_then(|call| call.model.clone())
                    .or_else(|| round.model.clone()),
                api: round
                    .trace
                    .and_then(|call| call.api.clone())
                    .or_else(|| round.api.clone()),
            },
            reported_usage: usage,
            stop_reason: round.trace.and_then(|call| call.finish_reason.clone()),
            timestamps: CallTimestamps {
                started_at_ms: round.trace.map(|call| call.started_at_ms),
                recorded_at_ms: round
                    .trace
                    .map(|call| call.ended_at_ms)
                    .or(round.recorded_at_ms),
            },
            context_item_ids,
            tool_calls_after,
            compaction_before,
        });
        // The response's thinking is sent back with later requests: encrypted for OpenAI
        // models, so it is sized by the reasoning tokens Copilot recorded for it.
        if let (Some(tokens), Some(model)) = (
            round.thinking_tokens.filter(|tokens| *tokens > 0),
            round.model.clone(),
        ) {
            self.insert(NormalizedContextItem::reported_thinking(
                format!("vscode-copilot:thinking:{request_id}:{}", round.id),
                Some(request_id.to_owned()),
                tokens,
                model,
            ));
        }
        if !blocks.is_empty() {
            let bytes = blocks
                .iter()
                .map(|block| match block {
                    AssistantContentBlock::Text(text) => byte_length(text),
                    AssistantContentBlock::ToolCall {
                        name, arguments, ..
                    } => byte_length(name).saturating_add(byte_length(arguments)),
                    _ => 0,
                })
                .fold(0_u64, u64::saturating_add);
            self.insert(NormalizedContextItem {
                id: format!("vscode-copilot:assistant:{request_id}:{}", round.id),
                kind: ContextItemKind::AssistantMessage,
                label: String::new(),
                source_record_id: Some(request_id.to_owned()),
                source_tool_call_id: None,
                metadata: BTreeMap::new(),
                serialized_size_bytes: bytes,
                payload: TokenizationPayload::AssistantMessage {
                    blocks,
                    source_provider: Some("github-copilot".into()),
                    source_model: round.model,
                    source_api: round.api,
                    // Thinking is its own item, sized by reported tokens.
                    thinking_reported: true,
                },
                presence: Vec::new(),
                first_model_call: 0,
                last_model_call: 0,
            });
        }
        for (id, name, arguments) in tools {
            // What the model was sent, when a trace input shows it; otherwise the session
            // file's result; otherwise the tool's own result from the trace records.
            let sent = self
                .traces
                .and_then(|traces| traces.sent_tool_results.get(base_tool_call_id(&id)));
            let content = match (sent, results.and_then(|results| results.get(&id))) {
                (Some(text), _) => Some(MessageContent::text(text.clone())),
                (None, Some(result)) => Some(self.recorded_result(result)),
                (None, None) => self
                    .traces
                    .and_then(|traces| traces.tool_results.get(base_tool_call_id(&id)))
                    .map(|text| MessageContent::text(text.clone())),
            };
            // A tool call that was cancelled before it ran has no result.
            if let Some(content) = content {
                self.apply_tool_result(request_id, &id, name, &arguments, content);
            }
        }
    }

    /// Copilot replaced the older conversation with a summary before call `before`. The
    /// call's input shows what it kept: workspace context, and the responses and tool
    /// results whose tool calls it still includes, with their thinking.
    fn compact(&mut self, summary: &str, call: &TraceCall, before: usize) -> String {
        let kept_call = |id: &str| call.input_tool_call_ids.contains(base_tool_call_id(id));
        let kept_assistants: HashSet<String> = self
            .active
            .iter()
            .map(|index| &self.items[*index])
            .filter(|item| match &item.payload {
                TokenizationPayload::AssistantMessage { blocks, .. } => {
                    blocks.iter().any(|block| match block {
                        AssistantContentBlock::ToolCall { id, .. } => kept_call(id),
                        _ => false,
                    })
                }
                _ => false,
            })
            .map(|item| item.id.clone())
            .collect();
        let kept = |item: &NormalizedContextItem| match item.kind {
            ContextItemKind::CustomMessage => true,
            ContextItemKind::AssistantMessage => kept_assistants.contains(&item.id),
            ContextItemKind::Thinking => {
                kept_assistants.contains(&item.id.replacen(":thinking:", ":assistant:", 1))
            }
            ContextItemKind::ToolResult => {
                item.source_tool_call_id.as_deref().is_some_and(kept_call)
            }
            _ => false,
        };
        let (retained, dropped): (Vec<usize>, Vec<usize>) = self
            .active
            .iter()
            .partition(|index| kept(&self.items[**index]));
        let id = format!("vscode-copilot:summary:{}", short_hash(summary));
        let summary_index = self.items.len();
        self.item_indexes.insert(id.clone(), summary_index);
        self.items.push(NormalizedContextItem {
            id: id.clone(),
            kind: ContextItemKind::CompactionSummary,
            label: "Conversation summary".into(),
            source_record_id: Some(call.span_id.clone()),
            source_tool_call_id: None,
            metadata: BTreeMap::new(),
            serialized_size_bytes: byte_length(summary),
            payload: TokenizationPayload::CompactionSummary(summary.to_owned()),
            presence: Vec::new(),
            first_model_call: 0,
            last_model_call: 0,
        });
        let (context, conversation): (Vec<usize>, Vec<usize>) = retained
            .iter()
            .partition(|index| self.items[**index].kind == ContextItemKind::CustomMessage);
        self.active = context
            .into_iter()
            .chain([summary_index])
            .chain(conversation)
            .collect();
        self.compactions.push(NormalizedCompaction {
            id: id.clone(),
            before_model_call: before,
            source_item_ids: dropped
                .iter()
                .map(|index| self.items[*index].id.clone())
                .collect(),
            retained_item_ids: retained
                .iter()
                .map(|index| self.items[*index].id.clone())
                .collect(),
            summary_item_id: id.clone(),
            tokens_before: None,
        });
        self.summary = Some(summary.to_owned());
        id
    }

    /// A tool result from the session file's `toolCallResults`.
    fn recorded_result(&mut self, result: &Value) -> MessageContent {
        let parts: Vec<ContentPart> = array(result.get("content"))
            .iter()
            .map(|part| {
                let text = match part.get("value") {
                    Some(Value::String(text)) => Some(text.clone()),
                    Some(value) => value.get("node").and_then(prompt_tree_text),
                    None => None,
                };
                text.map_or_else(
                    || {
                        self.limitations.insert(Limitation::UnsupportedContent);
                        ContentPart::Unsupported
                    },
                    ContentPart::Text,
                )
            })
            .collect();
        MessageContent { parts }
    }

    fn apply_tool_result(
        &mut self,
        request_id: &str,
        id: &str,
        name: String,
        arguments: &str,
        content: MessageContent,
    ) {
        let input: Value = serde_json::from_str(arguments).unwrap_or(Value::Null);
        let mut metadata = BTreeMap::new();
        if !name.is_empty() {
            metadata.insert("toolName".into(), name.clone());
        }
        self.insert(NormalizedContextItem {
            id: format!("vscode-copilot:tool:{id}"),
            kind: ContextItemKind::ToolResult,
            label: tool_result_label(&name, &input, self.working_directory.as_deref()),
            source_record_id: Some(request_id.to_owned()),
            source_tool_call_id: Some(id.to_owned()),
            metadata,
            serialized_size_bytes: content_bytes(&content),
            payload: TokenizationPayload::ToolResult {
                tool_call_id: id.to_owned(),
                tool_name: name,
                content,
                is_error: false,
            },
            presence: Vec::new(),
            first_model_call: 0,
            last_model_call: 0,
        });
    }

    fn insert(&mut self, item: NormalizedContextItem) -> usize {
        let index = self.items.len();
        self.item_indexes.insert(item.id.clone(), index);
        self.items.push(item);
        self.active.push(index);
        index
    }

    fn finish(
        self,
        id: String,
        title: Option<String>,
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
        // An item added after the last call (the final response) was never sent.
        let visible: HashSet<String> = items
            .iter()
            .filter(|item| !item.presence.is_empty())
            .map(|item| item.id.clone())
            .collect();
        let compactions: Vec<NormalizedCompaction> = compactions
            .into_iter()
            .filter(|compaction| visible.contains(&compaction.summary_item_id))
            .map(|mut compaction| {
                compaction.source_item_ids.retain(|id| visible.contains(id));
                compaction
                    .retained_item_ids
                    .retain(|id| visible.contains(id));
                compaction
            })
            .collect();
        let mut lineage: Vec<NormalizedLineageEdge> = compactions
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
        lineage.sort_by(|left, right| {
            left.to
                .cmp(&right.to)
                .then_with(|| left.from.cmp(&right.from))
        });
        let mut context_items: Vec<_> = items
            .into_iter()
            .filter(|item| visible.contains(&item.id))
            .collect();
        context_items.sort_by(|left, right| {
            left.first_model_call
                .cmp(&right.first_model_call)
                .then_with(|| left.id.cmp(&right.id))
        });
        NormalizedSession {
            harness_session_cost: None,
            id,
            source,
            title,
            working_directory,
            context_items,
            model_calls: calls,
            compactions,
            lineage,
        }
    }
}

/// The request's model calls, from `result.metadata.toolCallRounds`. A request that
/// recorded no rounds (older versions, or one still running) but has a response is one
/// call, whose response is the request's markdown.
fn rounds<'t>(request: &Value, request_id: &str) -> Result<Vec<Round<'t>>, SourceError> {
    let metadata = request.pointer("/result/metadata");
    let request_model = model_name(
        metadata
            .and_then(|metadata| text(metadata.get("resolvedModel")))
            .or_else(|| text(request.get("modelId"))),
    );
    let recorded = array(metadata.and_then(|metadata| metadata.get("toolCallRounds")));
    if !recorded.is_empty() {
        return recorded
            .iter()
            .enumerate()
            .map(|(position, round)| {
                Ok(Round {
                    id: text(round.get("id")).unwrap_or_else(|| format!("{position}")),
                    model: model_name(text(round.get("modelId"))).or_else(|| request_model.clone()),
                    api: match round.get("originApi").and_then(Value::as_str) {
                        Some("responses") => Some("openai-responses".into()),
                        Some("messages") => Some("anthropic-messages".into()),
                        _ => None,
                    },
                    recorded_at_ms: round.get("timestamp").and_then(Value::as_i64),
                    response: round
                        .get("response")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_owned(),
                    thinking_tokens: counter(
                        round.pointer("/thinking/tokens"),
                        "toolCallRounds.thinking.tokens",
                    )?,
                    tool_calls: array(round.get("toolCalls"))
                        .iter()
                        .filter_map(|call| {
                            Some((
                                text(call.get("id"))?,
                                text(call.get("name")).unwrap_or_default(),
                                call.get("arguments")
                                    .and_then(Value::as_str)
                                    .unwrap_or("{}")
                                    .to_owned(),
                            ))
                        })
                        .collect(),
                    combined: false,
                    trace: None,
                })
            })
            .collect();
    }
    let response = markdown(request);
    // A request cancelled before a response, or one that failed with an error, never got
    // an answer from a model.
    let failed = request.pointer("/result/errorDetails").is_some();
    if response.is_empty() && (request.get("result").is_none() || failed) {
        return Ok(Vec::new());
    }
    Ok(vec![Round {
        id: format!("{request_id}:response"),
        model: request_model,
        api: None,
        recorded_at_ms: request
            .pointer("/modelState/completedAt")
            .and_then(Value::as_i64),
        response,
        thinking_tokens: None,
        tool_calls: Vec::new(),
        combined: array(request.get("response")).iter().any(|part| {
            part.get("kind").and_then(Value::as_str) == Some("toolInvocationSerialized")
        }),
        trace: None,
    }])
}

/// `copilot/gpt-4.1` is `gpt-4.1`. `auto` names no model.
fn model_name(model: Option<String>) -> Option<String> {
    let model = model?;
    let model = model.strip_prefix("copilot/").unwrap_or(&model);
    (model != "auto" && !model.is_empty()).then(|| model.to_owned())
}

/// Copilot's rendered prompt parts: text (`type` 1) and images (`type` 0). Cache
/// markers (`type` 3) carry no content.
fn rendered(value: Option<&Value>) -> MessageContent {
    let parts = array(value)
        .iter()
        .filter_map(|part| match part.get("type").and_then(Value::as_u64) {
            Some(1) => part
                .get("text")
                .and_then(Value::as_str)
                .map(|text| ContentPart::Text(text.to_owned())),
            Some(0) => Some(ContentPart::Image(ImageDescriptor {
                media_type: part
                    .pointer("/imageUrl/mediaType")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
                encoded_data_length: None,
                dimensions: None,
            })),
            _ => None,
        })
        .collect();
    MessageContent { parts }
}

/// A tool result Copilot recorded as a rendered prompt tree: elements (`type` 1) whose
/// children are elements or text (`type` 2). The text, in order, is what the model was
/// sent. `None` when the tree has a node of another type.
fn prompt_tree_text(node: &Value) -> Option<String> {
    let mut text = String::new();
    let mut pending = vec![node];
    while let Some(node) = pending.pop() {
        match node.get("type").and_then(Value::as_u64)? {
            1 => pending.extend(array(node.get("children")).iter().rev()),
            2 => {
                if node.get("lineBreakBefore").and_then(Value::as_bool) == Some(true)
                    && !text.is_empty()
                    && !text.ends_with('\n')
                {
                    text.push('\n');
                }
                text.push_str(node.get("text").and_then(Value::as_str)?);
            }
            _ => return None,
        }
    }
    Some(text)
}

/// The response's markdown parts, which have no `kind` or `kind: "markdownContent"`.
fn markdown(request: &Value) -> String {
    array(request.get("response"))
        .iter()
        .filter(|part| {
            matches!(
                part.get("kind").and_then(Value::as_str),
                None | Some("markdownContent")
            )
        })
        .filter_map(|part| {
            part.get("value")
                .and_then(|value| value.as_str().or_else(|| value.get("value")?.as_str()))
        })
        .collect::<Vec<_>>()
        .join("")
}

/// A short, stable name for a system prompt or tool definition's text.
fn short_hash(text: &str) -> String {
    blake3::hash(text.as_bytes()).to_hex()[..16].to_owned()
}

fn byte_length(text: &str) -> u64 {
    u64::try_from(text.len()).unwrap_or(u64::MAX)
}

fn content_bytes(content: &MessageContent) -> u64 {
    content
        .parts
        .iter()
        .map(|part| match part {
            ContentPart::Text(text) => byte_length(text),
            _ => 0,
        })
        .fold(0_u64, u64::saturating_add)
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
    match names.len() {
        0 => "Assistant response".into(),
        1..=3 => format!("Assistant · {}", names.join(", ")),
        count => format!("Assistant · {}, +{} more", names[..3].join(", "), count - 3),
    }
}

/// Labels for Copilot's built-in file, terminal and search tools. Other tools keep a
/// generic label rather than guessing what their arguments mean.
fn tool_result_label(name: &str, input: &Value, working_directory: Option<&str>) -> String {
    let argument = |key: &str| {
        input
            .get(key)
            .and_then(Value::as_str)
            .map(bounded_label)
            .filter(|text| !text.is_empty())
    };
    let path = |key: &str| {
        input
            .get(key)
            .and_then(Value::as_str)
            .map(|path| bounded_label(&display_path_argument(path, working_directory)))
            .filter(|text| !text.is_empty())
    };
    let detail = match name {
        "read_file" | "create_file" | "replace_string_in_file" | "insert_edit_into_file" => {
            path("filePath")
        }
        "list_dir" => path("path"),
        "run_in_terminal" => argument("command"),
        "grep_search" | "file_search" | "semantic_search" => argument("query"),
        _ => None,
    };
    let name = bounded_label(name);
    match (name.is_empty(), detail) {
        (true, _) => "Tool result".into(),
        (false, Some(detail)) => format!("{name} result · {detail}"),
        (false, None) => format!("{name} result"),
    }
}
