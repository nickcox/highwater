//! Turns a Copilot session's event log into normalised model calls, context items and
//! compactions. docs/sources/copilot.md describes the rules.

use crate::{
    claude_code::{reconstruct::assistant_label, Limitation},
    domain::*,
    pi::reconstruct::{bounded_label, display_path_argument, first_nonempty_line},
};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

pub(crate) struct Reconstruction {
    pub session: NormalizedSession,
    pub limitations: BTreeSet<Limitation>,
    pub records: usize,
}

/// The model call of the assistant turn in progress.
struct OpenCall {
    call: usize,
    /// The usage record's `apiCallId`, which its `assistant.message` repeats.
    api_call_id: Option<String>,
    /// The response's item, once its `assistant.message` has been read.
    item: Option<usize>,
}

/// A compaction that has started and not yet been applied.
struct CompactionStart {
    attempt: Option<String>,
    /// The items in context when it started, in order.
    items: Vec<usize>,
    /// The first call made after it started.
    next_call: usize,
    background: bool,
}

#[derive(Default)]
struct State {
    session_id: Option<String>,
    working_directory: Option<String>,
    model: Option<String>,
    version: Option<String>,
    harness_session_cost: Option<HarnessSessionCost>,
    items: Vec<NormalizedContextItem>,
    item_indexes: HashMap<String, usize>,
    /// Items in context for the next call, in order. System messages come first.
    active: Vec<usize>,
    calls: Vec<NormalizedModelCall>,
    /// Whether an assistant turn is in progress.
    in_turn: bool,
    open: Option<OpenCall>,
    /// Tool name and arguments by tool-call ID, for labelling results.
    tool_calls: HashMap<String, (String, Value)>,
    /// The model call that requested each tool call.
    tool_call_owner: HashMap<String, usize>,
    /// The latest content of each skill, by name.
    skills: HashMap<String, String>,
    compactions: Vec<NormalizedCompaction>,
    next_compaction: Option<String>,
    /// The compaction in progress. A background compaction runs while later calls add to the
    /// context.
    compaction_start: Option<CompactionStart>,
    limitations: BTreeSet<Limitation>,
}

/// `text` is the session's `events.jsonl`. An unfinished last line (no `\n` after it) is
/// skipped. `fallback_id` is used when `session.start` has no session ID.
pub(crate) fn reconstruct(text: &str, fallback_id: &str) -> Result<Reconstruction, SourceError> {
    let mut state = State {
        // Copilot records how many tokens its tool definitions took, but not the definitions.
        limitations: [Limitation::MissingHistoricalToolDefinitions].into(),
        ..State::default()
    };
    let lines: Vec<&str> = text.split('\n').collect();
    let mut records = 0;
    for (index, line) in lines.iter().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let record = match serde_json::from_str::<Value>(line) {
            Ok(record) => record,
            Err(_) if index + 1 == lines.len() => break,
            Err(source) => {
                return Err(SourceError::Json {
                    line: index + 1,
                    source,
                })
            }
        };
        records += 1;
        state.apply(index + 1, &record);
    }
    let id = state
        .session_id
        .clone()
        .unwrap_or_else(|| fallback_id.to_owned());
    let working_directory = state.working_directory.clone();
    let version = state
        .version
        .clone()
        .unwrap_or_else(|| "unknown".to_owned());
    Ok(Reconstruction {
        limitations: std::mem::take(&mut state.limitations),
        session: state.finish(
            id,
            working_directory,
            SourceDescriptor {
                kind: "copilot".into(),
                version,
                cost_basis: CostBasis::Unknown,
            },
        ),
        records,
    })
}

fn text(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .filter(|text| !text.is_empty())
        .map(str::to_owned)
}

fn count(value: &Value, key: &str) -> Option<u64> {
    value
        .get(key)
        .and_then(Value::as_u64)
        .filter(|count| *count <= MAX_SAFE_JSON_INTEGER)
}

impl State {
    fn apply(&mut self, line: usize, record: &Value) {
        let data = record.get("data").unwrap_or(&Value::Null);
        match origin(record) {
            Origin::Main => {}
            Origin::Checkpoint => return,
            Origin::Subagent => {
                self.limitations.insert(Limitation::SubagentCallsNotShown);
                return;
            }
        }
        let at = timestamp_ms(record);
        match record.get("type").and_then(Value::as_str).unwrap_or("") {
            "session.start" => {
                self.session_id = text(data, "sessionId").or(self.session_id.take());
                self.version = text(data, "copilotVersion").or(self.version.take());
                self.model = text(data, "selectedModel").or(self.model.take());
                if let Some(cwd) = data.get("context").and_then(|context| text(context, "cwd")) {
                    self.working_directory.get_or_insert(cwd);
                }
            }
            "session.resume" => {
                self.model = text(data, "selectedModel").or(self.model.take());
            }
            "session.model_change" => {
                self.model = text(data, "newModel").or(self.model.take());
            }
            "system.message" => self.apply_system(line, data),
            "user.message" => self.apply_user(line, data),
            "skill.invoked" => {
                if let (Some(name), Some(content)) = (text(data, "name"), text(data, "content")) {
                    self.skills.insert(name, content);
                }
            }
            "skill.context_delivered_ref" => self.apply_skill_context(line, data),
            "system.notification" => {
                if let Some(content) = text(data, "content") {
                    let label = first_nonempty_line(&content).map_or_else(
                        || "Notification".into(),
                        |line| format!("Notification · {line}"),
                    );
                    let bytes = content.len() as u64;
                    self.insert(item(
                        format!("copilot:notification:{line}"),
                        ContextItemKind::CustomMessage,
                        label,
                        TokenizationPayload::CustomMessage(MessageContent::text(content)),
                        bytes,
                    ));
                }
            }
            "assistant.turn_start" => {
                self.open = None;
                self.in_turn = true;
            }
            "assistant.turn_end" | "abort" => {
                self.open = None;
                self.in_turn = false;
            }
            "session.usage_checkpoint" => {
                if let Some(cost) = usage_checkpoint_cost(record) {
                    self.harness_session_cost = Some(cost);
                }
            }
            "session.usage_record" => self.apply_usage(line, data, at),
            "assistant.message" => self.apply_message(line, data, at),
            "tool.execution_start" => {
                if let Some(id) = text(data, "toolCallId") {
                    let name = text(data, "toolName").unwrap_or_default();
                    let arguments = data.get("arguments").cloned().unwrap_or(Value::Null);
                    self.tool_calls.insert(id, (name, arguments));
                }
            }
            "tool.execution_complete" => self.apply_tool_result(line, data),
            "session.compaction_start" => {
                self.compaction_start = Some(CompactionStart {
                    attempt: text(data, "compactionAttemptId"),
                    items: self.active.clone(),
                    next_call: self.calls.len() + 1,
                    background: text(data, "execution").as_deref() == Some("background"),
                });
            }
            "session.compaction_complete" => self.apply_compaction(line, data, at),
            "session.truncation" => {
                if let Some(removed) = count(data, "messagesRemovedDuringTruncation") {
                    self.remove_oldest(Some(removed));
                    self.limitations
                        .insert(Limitation::UnverifiedCompactionRetention);
                }
            }
            "session.context_cleared" => {
                self.remove_oldest(None);
            }
            _ => {}
        }
    }

    /// Adds an item without putting it in the context. The same ID is the same item.
    fn add(&mut self, item: NormalizedContextItem) -> usize {
        if let Some(index) = self.item_indexes.get(&item.id) {
            return *index;
        }
        let index = self.items.len();
        self.item_indexes.insert(item.id.clone(), index);
        self.items.push(item);
        index
    }

    /// Adds an item and puts it at the end of the context.
    fn insert(&mut self, item: NormalizedContextItem) -> usize {
        let index = self.add(item);
        if !self.active.contains(&index) {
            self.active.push(index);
        }
        index
    }

    /// The number of system messages at the front of the context.
    fn system_count(&self) -> usize {
        self.active
            .iter()
            .take_while(|index| self.items[**index].kind == ContextItemKind::System)
            .count()
    }

    /// A system message replaces the one before it, unless it repeats it exactly.
    fn apply_system(&mut self, line: usize, data: &Value) {
        let Some(content) = text(data, "content") else {
            return;
        };
        let current = self.active[..self.system_count()].to_vec();
        let unchanged = current.iter().any(|index| {
            matches!(&self.items[*index].payload,
                TokenizationPayload::SystemPrompt { text, .. } if *text == content)
        });
        if unchanged {
            return;
        }
        self.active.retain(|index| !current.contains(index));
        let bytes = content.len() as u64;
        let index = self.add(item(
            format!("copilot:system:{line}"),
            ContextItemKind::System,
            "System prompt".into(),
            TokenizationPayload::SystemPrompt {
                text: content,
                complete: true,
            },
            bytes,
        ));
        self.active.insert(0, index);
    }

    /// The model is sent `transformedContent` (the message with the date and any attached
    /// context); the label uses the text the user typed.
    fn apply_user(&mut self, line: usize, data: &Value) {
        let typed = text(data, "content").unwrap_or_default();
        let sent = text(data, "transformedContent").unwrap_or_else(|| typed.clone());
        let mut content = MessageContent::text(sent);
        for attachment in data
            .get("attachments")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            let media_type = text(attachment, "mimeType");
            match attachment.get("type").and_then(Value::as_str) {
                // Text attachments are included in `transformedContent`.
                Some("file" | "directory" | "selection") => {}
                Some("blob")
                    if media_type
                        .as_deref()
                        .is_some_and(|media_type| media_type.starts_with("image/")) =>
                {
                    content
                        .parts
                        .push(ContentPart::Image(ImageDescriptor::from_encoded(
                            media_type.as_deref(),
                            attachment.get("data").and_then(Value::as_str),
                        )));
                }
                _ => {
                    self.limitations.insert(Limitation::UnsupportedContent);
                }
            }
        }
        let label = first_nonempty_line(&typed)
            .map_or_else(|| "User message".into(), |line| format!("User · {line}"));
        let bytes = data.to_string().len() as u64;
        self.insert(item(
            format!("copilot:user:{line}"),
            ContextItemKind::UserMessage,
            label,
            TokenizationPayload::UserMessage(content),
            bytes,
        ));
    }

    /// A skill's instructions are sent as their own message, wrapped in a `<skill-context>`
    /// tag. The event names the skill as `skill-<name>`; its text is the latest
    /// `skill.invoked` for that name.
    fn apply_skill_context(&mut self, line: usize, data: &Value) {
        let name = text(data, "source")
            .map(|source| {
                source
                    .strip_prefix("skill-")
                    .map_or(source.clone(), str::to_owned)
            })
            .unwrap_or_default();
        let Some(content) = self.skills.get(&name).cloned() else {
            self.limitations.insert(Limitation::UnrenderedAttachments);
            return;
        };
        let message = format!(
            "{}{}{}",
            text(data, "prefix").unwrap_or_default(),
            content,
            text(data, "suffix").unwrap_or_default()
        );
        let bytes = message.len() as u64;
        let label = if name.is_empty() {
            "Skill".into()
        } else {
            format!("Skill · {}", bounded_label(&name))
        };
        let mut skill = item(
            format!("copilot:skill:{line}"),
            ContextItemKind::CustomMessage,
            label,
            TokenizationPayload::CustomMessage(MessageContent::text(message)),
            bytes,
        );
        skill.metadata.insert("skillName".into(), name);
        self.insert(skill);
    }

    /// The call of the turn in progress, or a new one with the context as it is now. A
    /// usage record and the message it belongs to share an `apiCallId`; a second one in the
    /// same turn is another call.
    fn call_for(&mut self, line: usize, api_call_id: Option<&str>, at: Option<i64>) -> usize {
        if let Some(open) = &self.open {
            let same = match (open.api_call_id.as_deref(), api_call_id) {
                (Some(left), Some(right)) => left == right,
                _ => open.item.is_none(),
            };
            if same {
                if open.api_call_id.is_none() {
                    if let Some(open) = &mut self.open {
                        open.api_call_id = api_call_id.map(str::to_owned);
                    }
                }
                return self.open.as_ref().map_or(0, |open| open.call);
            }
        }
        let index = self.calls.len() + 1;
        let context_item_ids = self
            .active
            .iter()
            .map(|item| self.items[*item].id.clone())
            .collect();
        for item in &self.active {
            self.items[*item].extend_presence(index);
        }
        self.calls.push(NormalizedModelCall {
            retried: false,
            tool_loadout_known: false,
            index,
            source_record_id: format!("line-{line}"),
            target: ModelTarget {
                provider: Some("github-copilot".into()),
                model: self.model.clone(),
                api: None,
            },
            reported_usage: ReportedUsage::default(),
            stop_reason: None,
            timestamps: CallTimestamps {
                started_at_ms: None,
                recorded_at_ms: at,
            },
            context_item_ids,
            tool_calls_after: Vec::new(),
            compaction_before: self.next_compaction.take(),
        });
        self.open = Some(OpenCall {
            call: index - 1,
            api_call_id: api_call_id.map(str::to_owned),
            item: None,
        });
        index - 1
    }

    /// Only the usage of the main agent's calls inside an assistant turn is read. Other
    /// records (if any) are Copilot's own calls.
    fn apply_usage(&mut self, line: usize, data: &Value, at: Option<i64>) {
        let Some(usage) = data.get("usage") else {
            return;
        };
        if !self.in_turn {
            self.limitations.insert(Limitation::UnrecordedHarnessCalls);
            return;
        }
        let call = self.call_for(line, text(usage, "apiCallId").as_deref(), at);
        let target = &mut self.calls[call].target;
        if let Some(model) = text(usage, "responseModel").or_else(|| text(usage, "model")) {
            target.model = Some(model);
        }
        target.api = api(usage);
        self.calls[call].stop_reason = text(usage, "finishReason");
        self.calls[call].reported_usage =
            reported_usage(usage, self.calls[call].target.api.as_deref());
        // `duration` runs from sending the request to the end of the response.
        if let (Some(end), Some(duration)) = (at, usage.get("duration").and_then(Value::as_f64)) {
            if duration.is_finite() && duration > 0.0 && duration < 1e12 {
                self.calls[call].timestamps.started_at_ms = Some(end - duration.round() as i64);
            }
        }
        self.calls[call].timestamps.recorded_at_ms = at;
    }

    fn apply_message(&mut self, line: usize, data: &Value, at: Option<i64>) {
        let call = self.call_for(line, text(data, "apiCallId").as_deref(), at);
        if self.calls[call].target.model.is_none() {
            self.calls[call].target.model = text(data, "model");
        }
        let target = self.calls[call].target.clone();
        let mut blocks = Vec::new();
        let reasoning = self.calls[call]
            .reported_usage
            .reasoning
            .filter(|tokens| *tokens > 0);
        let reasoning_text = text(data, "reasoningText");
        let has_reasoning = reasoning_text.is_some()
            || text(data, "reasoningOpaque").is_some()
            || text(data, "encryptedContent").is_some();
        if let (Some(text), None) = (&reasoning_text, reasoning) {
            blocks.push(AssistantContentBlock::Thinking {
                text: text.clone(),
                provider_signature: None,
            });
        }
        if let Some(content) = text(data, "content") {
            blocks.push(AssistantContentBlock::Text(content));
        }
        for request in data
            .get("toolRequests")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            let id = text(request, "toolCallId").unwrap_or_default();
            let name = text(request, "name").unwrap_or_default();
            let arguments = match request.get("arguments") {
                Some(Value::String(arguments)) => arguments.clone(),
                Some(arguments) => arguments.to_string(),
                None => String::new(),
            };
            self.tool_call_owner.insert(id.clone(), call);
            self.calls[call].tool_calls_after.push(NormalizedToolCall {
                id: id.clone(),
                name: name.clone(),
                failed: false,
            });
            blocks.push(AssistantContentBlock::ToolCall {
                id,
                name,
                arguments,
            });
        }
        let thinking_reported = has_reasoning && reasoning.is_some();
        let bytes = data.to_string().len() as u64;
        let response = self.insert(item(
            format!("copilot:response:{line}"),
            ContextItemKind::AssistantMessage,
            String::new(),
            TokenizationPayload::AssistantMessage {
                blocks,
                source_provider: target.provider.clone(),
                source_model: target.model.clone(),
                source_api: target.api.clone(),
                thinking_reported,
            },
            bytes,
        ));
        if let Some(open) = &mut self.open {
            open.item = Some(response);
        }
        // Encrypted reasoning is sent back with later calls. Its size is the reported
        // reasoning tokens, and it comes before the response's text and tool calls.
        if let (true, Some(tokens)) = (thinking_reported, reasoning) {
            let thinking = NormalizedContextItem::reported_thinking(
                format!("copilot:thinking:{line}"),
                None,
                tokens,
                target.model.unwrap_or_default(),
            );
            let index = self.add(thinking);
            if let Some(position) = self.active.iter().position(|active| *active == response) {
                self.active.insert(position, index);
            }
        }
    }

    fn apply_tool_result(&mut self, line: usize, data: &Value) {
        let Some(call_id) = text(data, "toolCallId") else {
            return;
        };
        let success = data.get("success").and_then(Value::as_bool).unwrap_or(true);
        let result = data.get("result");
        let mut content = match result.and_then(|result| result.get("content")) {
            Some(Value::String(text)) => MessageContent::text(text.clone()),
            _ => match data.get("error").and_then(|error| text(error, "message")) {
                Some(message) => MessageContent::text(message),
                None => MessageContent::empty(),
            },
        };
        if result
            .and_then(|result| result.get("binaryResultsForLlm"))
            .and_then(Value::as_array)
            .is_some_and(|results| !results.is_empty())
        {
            content.parts.push(ContentPart::Unsupported);
            self.limitations.insert(Limitation::UnsupportedContent);
        }
        let (name, arguments) = self
            .tool_calls
            .get(&call_id)
            .cloned()
            .unwrap_or((String::new(), Value::Null));
        if !success {
            if let Some(owner) = self.tool_call_owner.get(&call_id) {
                if let Some(tool_call) = self.calls[*owner]
                    .tool_calls_after
                    .iter_mut()
                    .find(|tool_call| tool_call.id == call_id)
                {
                    tool_call.failed = true;
                }
            }
        }
        let bytes = data.to_string().len() as u64;
        let mut result = item(
            format!("copilot:tool-result:{line}"),
            ContextItemKind::ToolResult,
            tool_result_label(&name, &arguments, self.working_directory.as_deref()),
            TokenizationPayload::ToolResult {
                tool_call_id: call_id.clone(),
                tool_name: name.clone(),
                content,
                is_error: !success,
            },
            bytes,
        );
        result.source_tool_call_id = Some(call_id);
        if !name.is_empty() {
            result.metadata.insert("toolName".into(), name);
        }
        self.insert(result);
    }

    /// Removes the oldest conversation messages, or all of them, keeping the system
    /// messages. A response's reported reasoning comes before it and goes with it, and is
    /// not counted.
    fn remove_oldest(&mut self, messages: Option<u64>) {
        let systems = self.system_count();
        let mut remaining = messages.unwrap_or(u64::MAX);
        let mut position = systems;
        while position < self.active.len() && remaining > 0 {
            if self.items[self.active[position]].kind != ContextItemKind::Thinking {
                remaining -= 1;
            }
            position += 1;
        }
        self.active.drain(systems..position);
    }

    /// A compaction keeps the last `preCompactionMessagesLength` less `messagesRemoved`
    /// messages of the context it started from, and everything added while it ran, and
    /// replaces the rest with its summary at the front of the conversation. Without those
    /// counts only the summary is kept. Its own call (`compactionTokensUsed`) comes before it.
    fn apply_compaction(&mut self, line: usize, data: &Value, at: Option<i64>) {
        let start = self.compaction_start.take();
        if data.get("success").and_then(Value::as_bool) != Some(true) {
            return;
        }
        let attempt = text(data, "compactionAttemptId");
        let start = start.filter(|start| start.attempt.is_none() || start.attempt == attempt);
        // The summariser was sent the context as it was when the compaction started.
        let summarised = start
            .as_ref()
            .map_or_else(|| self.active.clone(), |start| start.items.clone());
        let summary_call = self.compaction_call(line, data, at, &summarised);
        if summary_call.is_none() {
            self.limitations.insert(Limitation::MissingCompactionUsage);
        }
        let systems = self.system_count();
        // Where the compaction started: just after the last item that was in context then.
        let end = match &start {
            Some(start) => {
                let items: HashSet<usize> = start.items.iter().copied().collect();
                self.active
                    .iter()
                    .rposition(|index| items.contains(index))
                    .map_or(systems, |position| position + 1)
            }
            None => self.active.len(),
        };
        let messages = |indexes: &[usize], items: &[NormalizedContextItem]| {
            indexes
                .iter()
                .filter(|index| items[**index].kind != ContextItemKind::Thinking)
                .count() as u64
        };
        let added_while_running = start
            .as_ref()
            .map(|_| messages(&self.active[end.max(systems)..], &self.items));
        let (before, removed) = (
            count(data, "preCompactionMessagesLength"),
            count(data, "messagesRemoved"),
        );
        let kept = match (before, removed) {
            (Some(before), Some(removed)) => Some(before.saturating_sub(removed)),
            _ => {
                self.limitations
                    .insert(Limitation::UnverifiedCompactionRetention);
                None
            }
        };
        // Counted back from where the compaction started. A response's reported reasoning
        // comes before it and goes with it.
        let mut cut = end.max(systems);
        let mut remaining = kept.unwrap_or(0);
        while cut > systems && remaining > 0 {
            cut -= 1;
            if self.items[self.active[cut]].kind != ContextItemKind::Thinking {
                remaining -= 1;
            }
        }
        if cut > systems && self.items[self.active[cut - 1]].kind == ContextItemKind::Thinking {
            cut -= 1;
        }
        let sources: Vec<usize> = self.active.drain(systems..cut).collect();
        // What remains up to where it started is what it kept; later items were added while
        // it ran.
        let kept_end = end.max(systems) - sources.len();
        let retained_item_ids: Vec<String> = self.active[systems..kept_end]
            .iter()
            .map(|index| self.items[*index].id.clone())
            .collect();
        let summary = text(data, "summaryContent").unwrap_or_default();
        let bytes = summary.len() as u64;
        let index = self.add(item(
            format!("copilot:compaction:{line}"),
            ContextItemKind::CompactionSummary,
            "Compaction summary".into(),
            TokenizationPayload::CompactionSummary(summary),
            bytes,
        ));
        self.active.insert(systems, index);
        let summary_item_id = self.items[index].id.clone();
        let duration = data
            .pointer("/summarizerProgress/durationMs")
            .or_else(|| data.pointer("/compactionTokensUsed/duration"))
            .and_then(Value::as_f64)
            .filter(|ms| ms.is_finite() && *ms >= 0.0 && *ms < 1e15)
            .map(|ms| ms.round() as u64);
        let details = CompactionDetails {
            trigger: match text(data, "trigger").as_deref() {
                Some("manual") => Some(CompactionTrigger::Manual),
                Some("threshold" | "context_limit_retry" | "memory_pressure" | "model_switch") => {
                    Some(CompactionTrigger::Automatic)
                }
                _ => None,
            },
            instructions: text(data, "customInstructions"),
            rule: Some(if kept.is_some() {
                CompactionRule::KeptLastMessages
            } else {
                CompactionRule::SummaryOnly
            }),
            started_before_model_call: start
                .as_ref()
                .filter(|start| start.background)
                .map(|start| start.next_call),
            summary_call,
            duration_ms: duration,
            messages_before: before,
            messages_removed: removed,
            messages_kept: kept,
            messages_added_while_running: added_while_running,
            tokens_after: count(data, "postCompactionTokens"),
            system_tokens_after: count(data, "systemTokens"),
            tool_definition_tokens_after: count(data, "toolDefinitionsTokens"),
            conversation_tokens_after: count(data, "conversationTokens"),
        };
        self.compactions.push(NormalizedCompaction {
            id: summary_item_id.clone(),
            before_model_call: self.calls.len() + 1,
            source_item_ids: sources
                .iter()
                .map(|index| self.items[*index].id.clone())
                .collect(),
            retained_item_ids,
            summary_item_id: summary_item_id.clone(),
            tokens_before: count(data, "preCompactionTokens"),
            details,
        });
        self.next_compaction = Some(summary_item_id);
    }

    /// The compaction's own call, from `compactionTokensUsed`, with `summarised` as its
    /// context. It is added when the compaction is applied, so a background compaction's
    /// call comes after the calls made while it ran, although it started before them.
    /// One that covers several requests is marked as an aggregate. Returns its index.
    fn compaction_call(
        &mut self,
        line: usize,
        data: &Value,
        at: Option<i64>,
        summarised: &[usize],
    ) -> Option<usize> {
        let used = data
            .get("compactionTokensUsed")
            .filter(|used| used.is_object())?;
        let model = text(used, "model").or_else(|| text(data, "model"));
        // The API is not recorded; a call to the same model earlier in the session used it.
        let api = self
            .calls
            .iter()
            .rev()
            .find(|call| call.target.model == model && call.target.api.is_some())
            .and_then(|call| call.target.api.clone());
        let index = self.calls.len() + 1;
        for item in summarised {
            self.items[*item].extend_presence(index);
        }
        let started_at_ms = match (at, used.get("duration").and_then(Value::as_f64)) {
            (Some(end), Some(duration))
                if duration.is_finite() && duration > 0.0 && duration < 1e12 =>
            {
                Some(end - duration.round() as i64)
            }
            _ => None,
        };
        let aggregate = used
            .get("requestCount")
            .and_then(Value::as_u64)
            .is_some_and(|count| count > 1);
        self.calls.push(NormalizedModelCall {
            retried: false,
            tool_loadout_known: false,
            index,
            source_record_id: format!("line-{line}"),
            reported_usage: reported_usage(used, api.as_deref()),
            target: ModelTarget {
                provider: Some("github-copilot".into()),
                model,
                api,
            },
            stop_reason: Some(if aggregate {
                "compaction-aggregate".into()
            } else {
                "compaction-call".into()
            }),
            timestamps: CallTimestamps {
                started_at_ms,
                recorded_at_ms: at,
            },
            context_item_ids: summarised
                .iter()
                .map(|item| self.items[*item].id.clone())
                .collect(),
            tool_calls_after: Vec::new(),
            compaction_before: self.next_compaction.take(),
        });
        Some(index)
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
            if item.label.is_empty() {
                item.label = assistant_label(&item.payload);
            }
        }
        NormalizedSession {
            harness_session_cost: self.harness_session_cost,
            turns: Vec::new(),
            id,
            source,
            title: None,
            working_directory,
            context_items: items,
            model_calls: calls,
            compactions,
            lineage: Vec::new(),
        }
        .finish_reconstruction(UnusedSummaries::Drop)
    }
}

/// The API a call used, from the endpoint its usage record names.
fn api(usage: &Value) -> Option<String> {
    match usage.get("apiEndpoint").and_then(Value::as_str)? {
        "/responses" | "ws:/responses" => Some("openai-responses".into()),
        "/v1/messages" => Some("anthropic-messages".into()),
        "/chat/completions" => Some("openai-completions".into()),
        _ => None,
    }
}

/// The US dollar value of a Copilot credit, as for VS Code Copilot (see
/// `vscode_copilot::reconstruct::CREDIT_USD`). The charge is recorded in billionths of a
/// credit.
const CREDIT_USD: f64 = 0.01;

fn nano_aiu_usd(value: Option<&Value>) -> Option<f64> {
    let nano = value?.as_f64()?;
    (nano.is_finite() && nano >= 0.0).then(|| nano / 1e9 * CREDIT_USD)
}

pub(crate) fn usage_checkpoint_cost(record: &Value) -> Option<HarnessSessionCost> {
    if record.get("type").and_then(Value::as_str) != Some("session.usage_checkpoint")
        || origin(record) != Origin::Main
    {
        return None;
    }
    Some(HarnessSessionCost {
        total_usd: nano_aiu_usd(record.pointer("/data/totalNanoAiu"))?,
        since_ms: None,
    })
}

/// `inputTokens` is the whole input, including cache reads and writes. For the Responses
/// API, `outputTokens` includes reasoning; for the others it is not known.
fn reported_usage(usage: &Value, api: Option<&str>) -> ReportedUsage {
    let cache_read = count(usage, "cacheReadTokens");
    let cache_write = count(usage, "cacheWriteTokens");
    let input = count(usage, "inputTokens").and_then(|input| {
        input
            .checked_sub(cache_read.unwrap_or(0))?
            .checked_sub(cache_write.unwrap_or(0))
    });
    let output = count(usage, "outputTokens");
    ReportedUsage {
        placeholder: None,
        input,
        input_total: None,
        output,
        recorded_output: output,
        output_reasoning_relationship: match api {
            Some("openai-responses") if output.is_some() => {
                OutputReasoningRelationship::IncludesReasoning
            }
            _ => OutputReasoningRelationship::Unknown,
        },
        cache_read: input.map(|_| cache_read.unwrap_or(0)),
        cache_write: input.map(|_| cache_write.unwrap_or(0)),
        cache_write_1h: None,
        reasoning: count(usage, "reasoningTokens"),
        total_tokens: None,
        cost: ReportedCost {
            total: nano_aiu_usd(usage.pointer("/copilotUsage/totalNanoAiu")),
            ..ReportedCost::default()
        },
    }
}

/// Who an event belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Origin {
    Main,
    /// A subagent's event carries its `agentId`, and its calls a `parentToolCallId`.
    Subagent,
    /// A replay checkpoint repeats earlier history.
    Checkpoint,
}

pub(super) fn origin(record: &Value) -> Origin {
    let present = |value: Option<&Value>| value.is_some_and(|value| !value.is_null());
    if record.get("checkpoint").and_then(Value::as_bool) == Some(true) {
        Origin::Checkpoint
    } else if present(record.get("agentId")) || present(record.pointer("/data/parentToolCallId")) {
        Origin::Subagent
    } else {
        Origin::Main
    }
}

fn item(
    id: String,
    kind: ContextItemKind,
    label: String,
    payload: TokenizationPayload,
    bytes: u64,
) -> NormalizedContextItem {
    NormalizedContextItem {
        id,
        kind,
        label,
        source_record_id: None,
        source_tool_call_id: None,
        metadata: BTreeMap::new(),
        serialized_size_bytes: bytes,
        payload,
        presence: Vec::new(),
    }
}

fn timestamp_ms(record: &Value) -> Option<i64> {
    record
        .get("timestamp")
        .and_then(Value::as_str)
        .and_then(|timestamp| chrono::DateTime::parse_from_rfc3339(timestamp).ok())
        .map(|timestamp| timestamp.timestamp_millis())
}

/// `bash` shows its command, `view` and `edit` their path, and `apply_patch` its first file.
fn tool_result_label(name: &str, arguments: &Value, working_directory: Option<&str>) -> String {
    let argument = |key: &str| {
        arguments
            .get(key)
            .and_then(Value::as_str)
            .and_then(first_nonempty_line)
    };
    let path = |path: &str| bounded_label(&display_path_argument(path, working_directory));
    let detail = match name {
        "bash" | "powershell" => argument("command"),
        "view" | "edit" | "create" => argument("path").map(|value| path(&value)),
        "apply_patch" => arguments.as_str().and_then(|patch| {
            patch.lines().find_map(|line| {
                ["*** Update File: ", "*** Add File: ", "*** Delete File: "]
                    .iter()
                    .find_map(|prefix| line.strip_prefix(prefix))
                    .map(path)
            })
        }),
        "skill" => argument("skill"),
        "grep" | "glob" => argument("pattern"),
        _ => None,
    }
    .filter(|detail| !detail.is_empty());
    let name = bounded_label(name);
    match (name.is_empty(), detail) {
        (true, _) => "Tool result".into(),
        (false, Some(detail)) => format!("{name} result · {detail}"),
        (false, None) => format!("{name} result"),
    }
}
