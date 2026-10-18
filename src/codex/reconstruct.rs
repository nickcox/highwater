//! Turns a Codex session file into normalized model calls, context items and compactions.
//! docs/sources/codex.md describes the rules.

use crate::{
    claude_code::{
        reconstruct::{assistant_label, extend_presence},
        Limitation,
    },
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

/// The response whose usage has not arrived yet.
struct OpenResponse {
    call: usize,
    item: usize,
    has_reasoning: bool,
    /// An input item (such as a tool output) was recorded after the response's own items.
    /// Another output item then starts a new call.
    after_input: bool,
    /// The first call of its turn.
    starts_turn: bool,
}

struct PendingCompaction {
    before_model_call: usize,
    source_item_ids: Vec<String>,
    retained_item_ids: Vec<String>,
    summary_item_id: String,
}

#[derive(Default)]
struct State {
    thread_id: Option<String>,
    working_directory: Option<String>,
    model: Option<String>,
    version: Option<String>,
    items: Vec<NormalizedContextItem>,
    item_indexes: HashMap<String, usize>,
    active: Vec<usize>,
    /// The system prompt and tool definitions at the front of `active`. Compaction only
    /// replaces the conversation after them.
    loadout: usize,
    /// Each input item's recorded JSON, to find the items a compaction keeps.
    recorded: HashMap<String, usize>,
    calls: Vec<NormalizedModelCall>,
    open: Option<OpenResponse>,
    /// Reasoning stays in the context until the end of its turn.
    turn_thinking: Vec<usize>,
    /// Tool name and arguments by call ID, for labelling results.
    tool_calls: HashMap<String, (String, String)>,
    compactions: Vec<PendingCompaction>,
    next_compaction: Option<String>,
    limitations: BTreeSet<Limitation>,
    /// A forked or spawned thread's file starts with a copy of the parent's history,
    /// including the parent's calls. Its turns started before the thread was created.
    forked: bool,
    inherited: bool,
    /// Items from this index on were made in the current turn.
    turn_start: usize,
    turn_has_call: bool,
}

/// `text` is the session file's text. Records are separated only by `\n`, because text
/// inside them can hold U+2028. An unfinished last line (no `\n` after it) is skipped.
/// `fallback_id` is used when `session_meta` has no thread ID.
pub(crate) fn reconstruct(text: &str, fallback_id: &str) -> Result<Reconstruction, SourceError> {
    let mut state = State {
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
    state.close_response();
    let working_directory = state.working_directory.clone();
    let thread_id = state
        .thread_id
        .clone()
        .unwrap_or_else(|| fallback_id.to_owned());
    let version = state
        .version
        .clone()
        .unwrap_or_else(|| "unknown".to_owned());
    Ok(Reconstruction {
        limitations: std::mem::take(&mut state.limitations),
        session: state.finish(
            thread_id,
            working_directory,
            SourceDescriptor {
                kind: "codex".into(),
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

impl State {
    fn apply(&mut self, line: usize, record: &Value) {
        let payload = record.get("payload").unwrap_or(&Value::Null);
        let kind = payload.get("type").and_then(Value::as_str).unwrap_or("");
        match record.get("type").and_then(Value::as_str) {
            Some("session_meta") => self.apply_meta(payload),
            Some("turn_context") => {
                self.model = text(payload, "model").or(self.model.take());
                if let Some(cwd) = text(payload, "cwd") {
                    self.working_directory.get_or_insert(cwd);
                }
            }
            Some("event_msg") => match kind {
                "task_started" => {
                    self.end_turn();
                    self.turn_start = self.items.len();
                    self.turn_has_call = false;
                    // Turn and thread IDs are UUIDv7, which sort in the order they were made.
                    if let (true, Some(turn), Some(thread)) =
                        (self.forked, text(payload, "turn_id"), &self.thread_id)
                    {
                        self.inherited = turn < *thread;
                    }
                }
                "token_count" => self.apply_usage(payload),
                _ => {}
            },
            Some("response_item") => self.apply_item(line, record, payload, kind),
            Some("compacted") => self.apply_compaction(line, payload),
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

    fn apply_meta(&mut self, meta: &Value) {
        if self.version.is_some() {
            return;
        }
        self.thread_id = text(meta, "id");
        self.forked = text(meta, "forked_from_id")
            .or_else(|| text(meta, "parent_thread_id"))
            .is_some();
        self.inherited = self.forked;
        self.version = text(meta, "cli_version");
        self.working_directory = text(meta, "cwd");
        if let Some(instructions) = meta
            .get("base_instructions")
            .and_then(|instructions| text(instructions, "text"))
        {
            let bytes = instructions.len() as u64;
            self.insert(item(
                "codex:system".into(),
                ContextItemKind::System,
                "System prompt".into(),
                TokenizationPayload::SystemPrompt {
                    text: instructions,
                    complete: true,
                },
                bytes,
            ));
        }
        // App tools come as namespaces of functions, or as single functions.
        let mut tools = Vec::new();
        for entry in meta
            .get("dynamic_tools")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            match entry.get("tools").and_then(Value::as_array) {
                Some(members) => {
                    let namespace = text(entry, "name");
                    for member in members {
                        let name = text(member, "name").unwrap_or_default();
                        let name = match &namespace {
                            Some(namespace) => format!("{namespace}.{name}"),
                            None => name,
                        };
                        tools.push((name, member));
                    }
                }
                None => tools.push((text(entry, "name").unwrap_or_default(), entry)),
            }
        }
        for (name, definition) in tools {
            let definition = definition.to_string();
            let bytes = definition.len() as u64;
            let mut tool = item(
                format!("codex:tool-definition:{name}"),
                ContextItemKind::ToolDefinition,
                format!("{} definition", bounded_label(&name)),
                TokenizationPayload::ToolDefinition {
                    text: definition,
                    complete: true,
                },
                bytes,
            );
            tool.metadata.insert("toolName".into(), name);
            self.insert(tool);
        }
        self.loadout = self.active.len();
    }

    /// Reasoning from earlier turns is not sent with the next turn's calls.
    fn end_turn(&mut self) {
        self.close_response();
        let ending: HashSet<usize> = self.turn_thinking.drain(..).collect();
        self.active.retain(|item| !ending.contains(item));
    }

    fn apply_item(&mut self, line: usize, record: &Value, payload: &Value, kind: &str) {
        if self.inherited {
            self.apply_inherited_item(line, payload, kind);
            return;
        }
        match kind {
            "reasoning" => {
                self.response(line, record).has_reasoning = true;
            }
            "message" if payload.get("role").and_then(Value::as_str) == Some("assistant") => {
                let text = output_text(payload);
                let item = self.response(line, record).item;
                if !text.is_empty() {
                    self.push_block(item, AssistantContentBlock::Text(text));
                }
            }
            "function_call" | "custom_tool_call" | "web_search_call" | "tool_search_call" => {
                let (id, name, arguments) = tool_call(payload, kind);
                let open = self.response(line, record);
                let (call, item) = (open.call, open.item);
                // OpenAI runs a web search inside the response, with further model steps, and
                // reports the usage of every step together.
                if kind == "web_search_call" {
                    self.calls[call].stop_reason = Some("web-search-aggregate".into());
                }
                self.calls[call].tool_calls_after.push(NormalizedToolCall {
                    id: id.clone(),
                    name: name.clone(),
                    failed: false,
                });
                self.tool_calls
                    .insert(id.clone(), (name.clone(), arguments.clone()));
                self.push_block(
                    item,
                    AssistantContentBlock::ToolCall {
                        id,
                        name,
                        arguments,
                    },
                );
            }
            "message"
            | "function_call_output"
            | "custom_tool_call_output"
            | "tool_search_output"
            | "agent_message" => {
                if let Some(open) = &mut self.open {
                    open.after_input = true;
                }
                if let Some(item) = self.input_item(format!("codex:item:{line}"), payload, kind) {
                    let index = self.insert(item);
                    self.recorded.insert(payload.to_string(), index);
                }
            }
            _ => {
                self.limitations.insert(Limitation::UnsupportedContent);
            }
        }
    }

    /// The parent's history is context for the thread's own first call, but its calls were
    /// the parent's. Its responses become plain items; their reasoning is left out, because
    /// it does not outlast the parent's turn.
    fn apply_inherited_item(&mut self, line: usize, payload: &Value, kind: &str) {
        let id = format!("codex:item:{line}");
        let block = match kind {
            "reasoning" => return,
            "message" if payload.get("role").and_then(Value::as_str) == Some("assistant") => {
                AssistantContentBlock::Text(output_text(payload))
            }
            "function_call" | "custom_tool_call" | "web_search_call" | "tool_search_call" => {
                let (call_id, name, arguments) = tool_call(payload, kind);
                self.tool_calls
                    .insert(call_id.clone(), (name.clone(), arguments.clone()));
                AssistantContentBlock::ToolCall {
                    id: call_id,
                    name,
                    arguments,
                }
            }
            _ => {
                if let Some(mut item) = self.input_item(id, payload, kind) {
                    item.metadata.insert("inherited".into(), "true".into());
                    let index = self.insert(item);
                    self.recorded.insert(payload.to_string(), index);
                } else {
                    self.limitations.insert(Limitation::UnsupportedContent);
                }
                return;
            }
        };
        let bytes = payload.to_string().len() as u64;
        let mut response = item(
            id,
            ContextItemKind::AssistantMessage,
            String::new(),
            TokenizationPayload::AssistantMessage {
                blocks: vec![block],
                source_provider: Some("openai".into()),
                source_model: self.model.clone(),
                source_api: Some("openai-responses".into()),
                thinking_reported: false,
            },
            bytes,
        );
        response.metadata.insert("inherited".into(), "true".into());
        self.insert(response);
    }

    /// The response an output item belongs to. A new call starts at a response's first
    /// output item, with the items in context at that point.
    fn response(&mut self, line: usize, record: &Value) -> &mut OpenResponse {
        if self.open.as_ref().is_some_and(|open| open.after_input) {
            self.close_response();
        }
        if self.open.is_none() {
            let index = self.calls.len() + 1;
            let context_item_ids = self
                .active
                .iter()
                .map(|item| self.items[*item].id.clone())
                .collect();
            for item in &self.active {
                extend_presence(&mut self.items[*item], index);
            }
            self.calls.push(NormalizedModelCall {
                retried: false,
                tool_loadout_known: false,
                index,
                source_record_id: format!("line-{line}"),
                target: ModelTarget {
                    provider: Some("openai".into()),
                    model: self.model.clone(),
                    api: Some("openai-responses".into()),
                },
                reported_usage: ReportedUsage::default(),
                stop_reason: None,
                timestamps: CallTimestamps {
                    started_at_ms: None,
                    recorded_at_ms: timestamp_ms(record),
                },
                context_item_ids,
                tool_calls_after: Vec::new(),
                compaction_before: self.next_compaction.take(),
            });
            let item = self.insert(item(
                format!("codex:response:{line}"),
                ContextItemKind::AssistantMessage,
                String::new(),
                TokenizationPayload::AssistantMessage {
                    blocks: Vec::new(),
                    source_provider: Some("openai".into()),
                    source_model: self.model.clone(),
                    source_api: Some("openai-responses".into()),
                    thinking_reported: false,
                },
                0,
            ));
            self.open = Some(OpenResponse {
                call: index - 1,
                item,
                has_reasoning: false,
                after_input: false,
                starts_turn: !self.turn_has_call,
            });
            self.turn_has_call = true;
        }
        self.open.as_mut().expect("a response is open")
    }

    fn push_block(&mut self, item: usize, block: AssistantContentBlock) {
        if let TokenizationPayload::AssistantMessage { blocks, .. } = &mut self.items[item].payload
        {
            blocks.push(block);
        }
    }

    /// `token_count` follows each response. One with no input or output, such as the one
    /// written after a compaction, is not a call.
    fn apply_usage(&mut self, payload: &Value) {
        let Some(usage) = payload
            .get("info")
            .and_then(|info| info.get("last_token_usage"))
        else {
            return;
        };
        let count = |key: &str| usage.get(key).and_then(Value::as_u64);
        if self.inherited
            || count("input_tokens").unwrap_or(0) == 0 && count("output_tokens").unwrap_or(0) == 0
        {
            return;
        }
        let Some(open) = &self.open else {
            return;
        };
        let (call, starts_turn) = (open.call, open.starts_turn);
        self.calls[call].reported_usage = reported_usage(usage);
        self.check_reported_input(call, starts_turn);
        self.close_response();
    }

    /// Codex does not record two things that change what a call is sent: how much of its
    /// parent's history a forked or spawned thread is given, and a context reset without a
    /// compaction. Both show when a call's reported input is under half its calculated
    /// context, which is judged here from text length (characters ÷ 4), enough for a gap
    /// that size.
    fn check_reported_input(&mut self, call: usize, starts_turn: bool) {
        let usage = &self.calls[call].reported_usage;
        let (Some(input), Some(read), Some(write)) =
            (usage.input, usage.cache_read, usage.cache_write)
        else {
            return;
        };
        let reported = input + read + write;
        let context: Vec<usize> = self.calls[call]
            .context_item_ids
            .iter()
            .filter_map(|id| self.item_indexes.get(id).copied())
            .collect();
        let size = |indexes: &[usize], items: &[NormalizedContextItem]| -> u64 {
            indexes
                .iter()
                .map(|index| rough_tokens(&items[*index].payload))
                .sum()
        };
        if reported.saturating_mul(2) >= size(&context, &self.items) {
            return;
        }
        let inherited: Vec<usize> = context
            .iter()
            .copied()
            .filter(|index| self.items[*index].metadata.contains_key("inherited"))
            .collect();
        if call == 0 && !inherited.is_empty() {
            // The thread was given only its parent's latest turns, or none: the oldest
            // inherited items go until the context fits the reported input.
            let mut total = size(&context, &self.items);
            let mut unsent = Vec::new();
            for index in inherited {
                if total <= reported {
                    break;
                }
                total = total.saturating_sub(rough_tokens(&self.items[index].payload));
                unsent.push(index);
            }
            self.leave_out(call, &unsent);
            self.limitations.insert(Limitation::InferredUnsentHistory);
        } else if starts_turn && call > 0 && self.calls[call].compaction_before.is_none() {
            // Everything before this turn was replaced by something the file does not record.
            let loadout: HashSet<usize> = self.active[..self.loadout].iter().copied().collect();
            let earlier: Vec<usize> = context
                .iter()
                .copied()
                .filter(|index| !loadout.contains(index) && *index < self.turn_start)
                .collect();
            if earlier.is_empty() {
                return;
            }
            self.leave_out(call, &earlier);
            let summary = self.summary_item(
                format!("codex:reset:{}", self.calls[call].source_record_id),
                "Context reset · inferred from usage",
            );
            let index = call + 1;
            extend_presence(&mut self.items[summary], index);
            let summary_id = self.items[summary].id.clone();
            self.calls[call]
                .context_item_ids
                .insert(self.loadout, summary_id.clone());
            self.active.insert(self.loadout, summary);
            self.calls[call].compaction_before = Some(summary_id.clone());
            self.compactions.push(PendingCompaction {
                before_model_call: index,
                source_item_ids: earlier
                    .iter()
                    .map(|index| self.items[*index].id.clone())
                    .collect(),
                retained_item_ids: Vec::new(),
                summary_item_id: summary_id,
            });
            self.limitations.insert(Limitation::InferredContextReset);
        }
    }

    /// Takes items out of a call's context, and out of the context from then on.
    fn leave_out(&mut self, call: usize, indexes: &[usize]) {
        let leaving: HashSet<usize> = indexes.iter().copied().collect();
        let ids: HashSet<String> = indexes
            .iter()
            .map(|index| self.items[*index].id.clone())
            .collect();
        self.calls[call]
            .context_item_ids
            .retain(|id| !ids.contains(id));
        for index in indexes {
            let presence = &mut self.items[*index].presence;
            if let Some(last) = presence.last_mut() {
                if last.end_call == call + 1 {
                    if last.start_call == call + 1 {
                        presence.pop();
                    } else {
                        last.end_call -= 1;
                    }
                }
            }
        }
        self.active.retain(|index| !leaving.contains(index));
        self.turn_thinking.retain(|index| !leaving.contains(index));
    }

    /// The response's reasoning is sent back with the rest of its turn's calls. Its text is
    /// encrypted, so its size is the response's reported reasoning tokens.
    fn close_response(&mut self) {
        let Some(open) = self.open.take() else {
            return;
        };
        let tokens = self.calls[open.call]
            .reported_usage
            .reasoning
            .filter(|tokens| *tokens > 0);
        let (true, Some(tokens)) = (open.has_reasoning, tokens) else {
            return;
        };
        if let TokenizationPayload::AssistantMessage {
            thinking_reported, ..
        } = &mut self.items[open.item].payload
        {
            *thinking_reported = true;
        }
        let model = self.calls[open.call]
            .target
            .model
            .clone()
            .unwrap_or_default();
        let keeps = keeps_prior_reasoning(&model);
        let thinking = NormalizedContextItem::reported_thinking(
            format!("codex:thinking:{}", self.calls[open.call].source_record_id),
            None,
            tokens,
            model,
        );
        let index = self.items.len();
        self.item_indexes.insert(thinking.id.clone(), index);
        self.items.push(thinking);
        // Reasoning comes before the response's text and tool calls.
        if let Some(position) = self.active.iter().position(|active| *active == open.item) {
            self.active.insert(position, index);
            if !keeps {
                self.turn_thinking.push(index);
            }
        }
    }

    fn input_item(&self, id: String, payload: &Value, kind: &str) -> Option<NormalizedContextItem> {
        let bytes = payload.to_string().len() as u64;
        match kind {
            "message" => {
                let role = payload.get("role").and_then(Value::as_str).unwrap_or("");
                let content = message_content(payload.get("content"));
                let first_line = content_first_line(&content);
                let harness = Some(role)
                    .filter(|role| *role != "assistant")
                    .and_then(|role| harness_label(role, first_line.as_deref()));
                let (kind, label, payload) = match harness {
                    Some(label) => (
                        ContextItemKind::CustomMessage,
                        label,
                        TokenizationPayload::CustomMessage(content),
                    ),
                    None if role == "assistant" => (
                        ContextItemKind::AssistantMessage,
                        String::new(),
                        TokenizationPayload::AssistantMessage {
                            blocks: vec![AssistantContentBlock::Text(content_text(&content))],
                            source_provider: Some("openai".into()),
                            source_model: self.model.clone(),
                            source_api: Some("openai-responses".into()),
                            thinking_reported: false,
                        },
                    ),
                    None => (
                        ContextItemKind::UserMessage,
                        match first_line {
                            Some(line) => format!("User · {line}"),
                            None if has_image(&content) => "User · Image".into(),
                            None => "User message".into(),
                        },
                        TokenizationPayload::UserMessage(content),
                    ),
                };
                Some(item(id, kind, label, payload, bytes))
            }
            "function_call_output" | "custom_tool_call_output" | "tool_search_output" => {
                let call_id = text(payload, "call_id").unwrap_or_default();
                let (name, arguments) =
                    self.tool_calls.get(&call_id).cloned().unwrap_or_else(|| {
                        let name = if kind == "tool_search_output" {
                            "tool_search"
                        } else {
                            ""
                        };
                        (name.to_owned(), String::new())
                    });
                let output = payload.get("output").or_else(|| payload.get("tools"));
                let content = match output {
                    Some(Value::String(text)) => MessageContent::text(text.clone()),
                    Some(Value::Array(_)) if kind != "tool_search_output" => {
                        message_content(output)
                    }
                    Some(other) => MessageContent::text(other.to_string()),
                    None => MessageContent::empty(),
                };
                let mut result = item(
                    id,
                    ContextItemKind::ToolResult,
                    tool_result_label(&name, &arguments, self.working_directory.as_deref()),
                    TokenizationPayload::ToolResult {
                        tool_call_id: call_id.clone(),
                        tool_name: name.clone(),
                        content,
                        is_error: false,
                    },
                    bytes,
                );
                result.source_tool_call_id = Some(call_id);
                if !name.is_empty() {
                    result.metadata.insert("toolName".into(), name);
                }
                Some(result)
            }
            "agent_message" => {
                let content = message_content(payload.get("content"));
                let label = content_first_line(&content)
                    .map_or_else(|| "Agent message".into(), |line| format!("Agent · {line}"));
                Some(item(
                    id,
                    ContextItemKind::CustomMessage,
                    label,
                    TokenizationPayload::CustomMessage(content),
                    bytes,
                ))
            }
            _ => None,
        }
    }

    /// `replacement_history` is the whole conversation after the compaction. Items it
    /// repeats exactly are retained; the encrypted `compaction` item is the summary.
    fn apply_compaction(&mut self, line: usize, payload: &Value) {
        self.close_response();
        self.limitations.insert(Limitation::MissingCompactionUsage);
        let replacement = payload
            .get("replacement_history")
            .and_then(Value::as_array)
            .map(Vec::as_slice)
            .unwrap_or_default();
        let previous: Vec<usize> = self.active.split_off(self.loadout);
        let current: HashSet<usize> = previous.iter().copied().collect();
        let mut kept = Vec::new();
        let mut retained = Vec::new();
        let mut summary = None;
        for (position, entry) in replacement.iter().enumerate() {
            let kind = entry.get("type").and_then(Value::as_str).unwrap_or("");
            if kind == "compaction" {
                let index = self.summary_item(
                    format!("codex:summary:{line}:{position}"),
                    "Compaction summary · encrypted",
                );
                summary.get_or_insert(index);
                kept.push(index);
                continue;
            }
            if let Some(index) = self
                .recorded
                .get(&entry.to_string())
                .copied()
                .filter(|index| current.contains(index) && !kept.contains(index))
            {
                retained.push(index);
                kept.push(index);
                continue;
            }
            match self.input_item(format!("codex:compaction:{line}:{position}"), entry, kind) {
                Some(item) => {
                    let index = self.add(item);
                    self.recorded.insert(entry.to_string(), index);
                    kept.push(index);
                }
                None => {
                    self.limitations.insert(Limitation::UnsupportedContent);
                }
            }
        }
        // Without a summary of its own, a compaction straight after another (with no call
        // between them) finishes that one: Codex can record the empty history of a new
        // context window and then the history it starts with. Otherwise what the compaction
        // kept is not known, and a summary stands in for it.
        let pending = self.next_compaction.as_ref().and_then(|id| {
            let index = *self.item_indexes.get(id)?;
            current.contains(&index).then_some(index)
        });
        let merged = summary.is_none() && pending.is_some();
        if merged {
            kept.insert(0, pending.expect("checked above"));
        } else if summary.is_none() {
            self.limitations
                .insert(Limitation::UnverifiedCompactionRetention);
            let index = self.summary_item(
                format!("codex:summary:{line}"),
                "Compaction summary · encrypted",
            );
            summary = Some(index);
            kept.push(index);
        }
        self.active.extend(&kept);
        self.turn_thinking.clear();
        let kept: HashSet<usize> = kept.into_iter().collect();
        let source_item_ids: Vec<String> = previous
            .iter()
            .filter(|index| !kept.contains(index))
            .map(|index| self.items[*index].id.clone())
            .collect();
        let retained_item_ids: Vec<String> = retained
            .iter()
            .map(|index| self.items[*index].id.clone())
            .collect();
        // A compaction in the parent's history only shapes the context the thread starts with.
        if self.inherited {
            return;
        }
        if merged {
            if let Some(compaction) = self.compactions.last_mut() {
                compaction.source_item_ids.extend(source_item_ids);
                compaction.retained_item_ids.extend(retained_item_ids);
            }
            return;
        }
        let summary_id = self.items[summary.expect("set above")].id.clone();
        self.compactions.push(PendingCompaction {
            before_model_call: self.calls.len() + 1,
            source_item_ids,
            retained_item_ids,
            summary_item_id: summary_id.clone(),
        });
        self.next_compaction = Some(summary_id);
    }

    /// The summary is encrypted, so it has no countable text.
    fn summary_item(&mut self, id: String, label: &str) -> usize {
        self.add(item(
            id,
            ContextItemKind::CompactionSummary,
            label.into(),
            TokenizationPayload::CompactionSummary(String::new()),
            0,
        ))
    }

    fn finish(
        self,
        id: String,
        working_directory: Option<String>,
        source: SourceDescriptor,
    ) -> NormalizedSession {
        let Self {
            mut items,
            mut calls,
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
            if !visible.contains(&compaction.summary_item_id) {
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
                    to: compaction.summary_item_id.clone(),
                    kind: "frameworkCompaction".into(),
                });
            }
            normalized_compactions.push(NormalizedCompaction {
                id: compaction.summary_item_id.clone(),
                before_model_call: compaction.before_model_call,
                source_item_ids: sources,
                retained_item_ids: compaction
                    .retained_item_ids
                    .into_iter()
                    .filter(|id| visible.contains(id))
                    .collect(),
                summary_item_id: compaction.summary_item_id,
                tokens_before: None,
            });
        }
        // A call only names a compaction that is shown.
        let shown: HashSet<&str> = normalized_compactions
            .iter()
            .map(|compaction| compaction.id.as_str())
            .collect();
        for call in &mut calls {
            if call
                .compaction_before
                .as_deref()
                .is_some_and(|id| !shown.contains(id))
            {
                call.compaction_before = None;
            }
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

/// A rough size for an item: characters ÷ 4, an image as 1,000 tokens, and reasoning at its
/// reported size. Only used to notice inputs far smaller than the calculated context.
fn rough_tokens(payload: &TokenizationPayload) -> u64 {
    let content = |content: &MessageContent| -> u64 {
        content
            .parts
            .iter()
            .map(|part| match part {
                ContentPart::Text(text) | ContentPart::ToolReference(text) => text.len() as u64 / 4,
                ContentPart::Image(_) => 1_000,
                ContentPart::Unsupported => 0,
            })
            .sum()
    };
    match payload {
        TokenizationPayload::UserMessage(message) | TokenizationPayload::CustomMessage(message) => {
            content(message)
        }
        TokenizationPayload::ToolResult {
            content: message, ..
        } => content(message),
        TokenizationPayload::AssistantMessage { blocks, .. } => blocks
            .iter()
            .map(|block| match block {
                AssistantContentBlock::Text(text) => text.len() as u64 / 4,
                AssistantContentBlock::ToolCall { arguments, .. } => arguments.len() as u64 / 4,
                _ => 0,
            })
            .sum(),
        TokenizationPayload::SystemPrompt { text, .. }
        | TokenizationPayload::ToolDefinition { text, .. }
        | TokenizationPayload::CompactionSummary(text) => text.len() as u64 / 4,
        TokenizationPayload::ReportedThinking { tokens, .. } => *tokens,
        _ => 0,
    }
}

/// Whether a model sends reasoning from earlier turns with later calls. Measured on Codex
/// sessions: GPT-5.5's input falls by the reasoning of the turn before at each new turn, while
/// GPT-5.6 and GPT-6 models' input does not. A model this does not recognise is assumed to
/// behave like the newest ones.
fn keeps_prior_reasoning(model: &str) -> bool {
    let Some(version) = model.strip_prefix("gpt-") else {
        return true;
    };
    let version = version.split('-').next().unwrap_or("");
    let mut parts = version.split('.').map(|part| part.parse::<u32>().ok());
    match (parts.next().flatten(), parts.next().flatten().unwrap_or(0)) {
        (Some(major), minor) => (major, minor) >= (5, 6),
        (None, _) => true,
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
        first_model_call: 0,
        last_model_call: 0,
    }
}

fn timestamp_ms(record: &Value) -> Option<i64> {
    record
        .get("timestamp")
        .and_then(Value::as_str)
        .and_then(|timestamp| chrono::DateTime::parse_from_rfc3339(timestamp).ok())
        .map(|timestamp| timestamp.timestamp_millis())
}

fn output_text(payload: &Value) -> String {
    payload
        .get("content")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|part| part.get("text").and_then(Value::as_str))
        .collect::<Vec<_>>()
        .join("\n")
}

/// The call ID, tool name and arguments of a tool call. Web and tool searches record
/// their request rather than arguments.
fn tool_call(payload: &Value, kind: &str) -> (String, String, String) {
    let id = text(payload, "call_id")
        .or_else(|| text(payload, "id"))
        .unwrap_or_default();
    match kind {
        "function_call" => (
            id,
            text(payload, "name").unwrap_or_default(),
            text(payload, "arguments").unwrap_or_default(),
        ),
        "custom_tool_call" => (
            id,
            text(payload, "name").unwrap_or_default(),
            text(payload, "input").unwrap_or_default(),
        ),
        "web_search_call" => (
            id,
            "web_search".into(),
            payload
                .get("action")
                .map(Value::to_string)
                .unwrap_or_default(),
        ),
        _ => (
            id,
            "tool_search".into(),
            payload
                .get("arguments")
                .map(|arguments| match arguments {
                    Value::String(text) => text.clone(),
                    other => other.to_string(),
                })
                .unwrap_or_default(),
        ),
    }
}

/// Text and image parts. An image is recorded as a `data:` URL.
fn message_content(content: Option<&Value>) -> MessageContent {
    let parts = match content {
        Some(Value::String(text)) => vec![ContentPart::Text(text.clone())],
        Some(Value::Array(parts)) => parts
            .iter()
            .map(|part| match part.get("type").and_then(Value::as_str) {
                Some("input_text" | "output_text" | "text") => ContentPart::Text(
                    part.get("text")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_owned(),
                ),
                Some("input_image") => image(part),
                _ => ContentPart::Unsupported,
            })
            .collect(),
        _ => Vec::new(),
    };
    MessageContent { parts }
}

fn image(part: &Value) -> ContentPart {
    let url = part.get("image_url").and_then(Value::as_str).unwrap_or("");
    let Some((media_type, data)) = url
        .strip_prefix("data:")
        .and_then(|rest| rest.split_once(";base64,"))
    else {
        return ContentPart::Unsupported;
    };
    ContentPart::Image(ImageDescriptor::from_encoded(Some(media_type), Some(data)))
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

/// Codex writes its own context (instructions, environment details, AGENTS.md) as
/// developer messages and as user messages that start with a tag. Those are labelled from
/// the tag; a user's own message gets `None`.
fn harness_label(role: &str, first_line: Option<&str>) -> Option<String> {
    let line = first_line.unwrap_or("");
    let tag = line
        .strip_prefix('<')
        .and_then(|rest| rest.split_once('>'))
        .map(|(tag, _)| tag)
        .filter(|tag| {
            !tag.is_empty()
                && !tag.starts_with('/')
                && tag.chars().all(|character| {
                    character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | ' ')
                })
        });
    if let Some(tag) = tag {
        let words = tag.replace(['_', '-'], " ");
        let mut characters = words.chars();
        let label = characters
            .next()
            .map(|first| first.to_uppercase().chain(characters).collect::<String>())
            .unwrap_or_default();
        return Some(bounded_label(&label));
    }
    if line.starts_with("# AGENTS.md") {
        return Some("AGENTS.md instructions".into());
    }
    match role {
        "developer" if line.is_empty() => Some("Developer message".into()),
        "developer" => Some(format!("Developer · {line}")),
        _ => None,
    }
}

/// `exec_command` shows its command, `apply_patch` its first file and `view_image` its path.
fn tool_result_label(name: &str, arguments: &str, working_directory: Option<&str>) -> String {
    let json = serde_json::from_str::<Value>(arguments).ok();
    let argument = |key: &str| {
        json.as_ref()
            .and_then(|json| json.get(key))
            .and_then(Value::as_str)
            .and_then(first_nonempty_line)
    };
    let path = |path: &str| bounded_label(&display_path_argument(path, working_directory));
    let detail = match name {
        "exec_command" => argument("cmd"),
        "shell" => json
            .as_ref()
            .and_then(|json| json.get("command"))
            .and_then(Value::as_array)
            .map(|parts| {
                parts
                    .iter()
                    .filter_map(Value::as_str)
                    .collect::<Vec<_>>()
                    .join(" ")
            })
            .and_then(|command| first_nonempty_line(&command)),
        "apply_patch" => arguments.lines().find_map(|line| {
            ["*** Update File: ", "*** Add File: ", "*** Delete File: "]
                .iter()
                .find_map(|prefix| line.strip_prefix(prefix))
                .map(path)
        }),
        "view_image" => argument("path").map(|value| path(&value)),
        "spawn_agent" => argument("task_name"),
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

/// OpenAI counts cached input inside `input_tokens` and reasoning inside `output_tokens`.
fn reported_usage(usage: &Value) -> ReportedUsage {
    let count = |key: &str| {
        usage
            .get(key)
            .and_then(Value::as_u64)
            .filter(|count| *count <= MAX_SAFE_JSON_INTEGER)
    };
    let cache_read = count("cached_input_tokens");
    let cache_write = count("cache_write_input_tokens");
    let input = count("input_tokens")
        .and_then(|input| input.checked_sub(cache_read.unwrap_or(0) + cache_write.unwrap_or(0)));
    let output = count("output_tokens");
    ReportedUsage {
        placeholder: None,
        input,
        input_total: None,
        output,
        recorded_output: output,
        output_reasoning_relationship: OutputReasoningRelationship::IncludesReasoning,
        cache_read: cache_read.or(Some(0)),
        cache_write: cache_write.or(Some(0)),
        cache_write_1h: None,
        reasoning: count("reasoning_output_tokens"),
        total_tokens: count("total_tokens"),
        cost: ReportedCost::default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn newer_gpt_models_keep_reasoning_from_earlier_turns() {
        assert!(!keeps_prior_reasoning("gpt-5.5"));
        assert!(!keeps_prior_reasoning("gpt-5.4-mini"));
        assert!(!keeps_prior_reasoning("gpt-5"));
        assert!(keeps_prior_reasoning("gpt-5.6-sol"));
        assert!(keeps_prior_reasoning("gpt-6-astra"));
        assert!(keeps_prior_reasoning("gpt-6.1-sol"));
        assert!(keeps_prior_reasoning("codex-auto-review"));
    }

    /// Two turns with one response each; the first response reasons.
    fn two_turns(model: &str) -> NormalizedSession {
        let usage = |reasoning: u64| {
            format!(
                r#"{{"type":"event_msg","payload":{{"type":"token_count","info":{{"last_token_usage":{{"input_tokens":1000,"cached_input_tokens":0,"output_tokens":50,"reasoning_output_tokens":{reasoning}}}}}}}}}"#
            )
        };
        let lines = [
            r#"{"type":"session_meta","payload":{"id":"thread","cli_version":"0.160.0"}}"#.to_owned(),
            format!(r#"{{"type":"turn_context","payload":{{"model":"{model}"}}}}"#),
            r#"{"type":"event_msg","payload":{"type":"task_started","turn_id":"turn-1"}}"#.to_owned(),
            r#"{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"First"}]}}"#.to_owned(),
            r#"{"type":"response_item","payload":{"type":"reasoning","encrypted_content":"x"}}"#.to_owned(),
            r#"{"type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"One"}]}}"#.to_owned(),
            usage(40),
            r#"{"type":"event_msg","payload":{"type":"task_started","turn_id":"turn-2"}}"#.to_owned(),
            r#"{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Second"}]}}"#.to_owned(),
            r#"{"type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Two"}]}}"#.to_owned(),
            usage(0),
        ];
        reconstruct(&(lines.join("\n") + "\n"), "thread")
            .expect("reconstructs")
            .session
    }

    fn second_call_has_thinking(session: &NormalizedSession) -> bool {
        session.model_calls[1]
            .context_item_ids
            .iter()
            .any(|id| id.starts_with("codex:thinking:"))
    }

    fn record(kind: &str, payload: &str) -> String {
        format!(r#"{{"type":"{kind}","payload":{payload}}}"#)
    }
    fn message(role: &str, text: &str) -> String {
        record(
            "response_item",
            &format!(
                r#"{{"type":"message","role":"{role}","content":[{{"type":"input_text","text":"{text}"}}]}}"#
            ),
        )
    }
    fn turn(id: &str) -> String {
        record(
            "event_msg",
            &format!(r#"{{"type":"task_started","turn_id":"{id}"}}"#),
        )
    }
    fn usage(input: u64) -> String {
        record(
            "event_msg",
            &format!(
                r#"{{"type":"token_count","info":{{"last_token_usage":{{"input_tokens":{input},"cached_input_tokens":0,"output_tokens":10,"reasoning_output_tokens":0}}}}}}"#
            ),
        )
    }
    fn read(lines: &[String]) -> Reconstruction {
        reconstruct(&(lines.join("\n") + "\n"), "thread").expect("reconstructs")
    }

    #[test]
    fn a_response_with_web_searches_has_combined_usage() {
        let loaded = read(&[
            record("session_meta", r#"{"id":"thread"}"#),
            turn("t1"),
            message("user", "Search"),
            record(
                "response_item",
                r#"{"type":"web_search_call","status":"completed","action":{"type":"search","query":"q"}}"#,
            ),
            message("assistant", "Found"),
            usage(9000),
            message("user", "Thanks"),
            message("assistant", "Welcome"),
            usage(1200),
        ]);
        let calls = &loaded.session.model_calls;
        assert_eq!(
            calls[0].stop_reason.as_deref(),
            Some("web-search-aggregate")
        );
        assert_eq!(calls[1].stop_reason, None);
    }

    #[test]
    fn a_thread_given_little_of_its_parent_history_leaves_the_oldest_out() {
        let long = "x".repeat(40_000);
        let loaded = read(&[
            record(
                "session_meta",
                r#"{"id":"01b00000-0000-7000-8000-000000000000","forked_from_id":"parent"}"#,
            ),
            turn("01a00000-0000-7000-8000-000000000001"),
            message("user", &long),
            turn("01a00000-0000-7000-8000-000000000002"),
            message("user", "Recent parent message"),
            turn("01c00000-0000-7000-8000-000000000003"),
            message("user", "The thread's own message"),
            message("assistant", "Reply"),
            usage(500),
        ]);
        let call = &loaded.session.model_calls[0];
        assert_eq!(
            call.context_item_ids.len(),
            2,
            "{:?}",
            call.context_item_ids
        );
        assert!(loaded
            .limitations
            .contains(&Limitation::InferredUnsentHistory));
        assert!(loaded
            .session
            .context_items
            .iter()
            .all(|item| !item.label.contains("xxxx")));
    }

    fn reset_session(second_input: u64) -> Reconstruction {
        let long = "x".repeat(40_000);
        read(&[
            record("session_meta", r#"{"id":"thread"}"#),
            turn("t1"),
            message("user", &long),
            message("assistant", "First"),
            usage(12_000),
            turn("t2"),
            message("user", "Second"),
            message("assistant", "Done"),
            usage(second_input),
        ])
    }

    #[test]
    fn a_turn_whose_input_falls_far_below_the_context_starts_after_a_reset() {
        let loaded = reset_session(400);
        let session = &loaded.session;
        assert_eq!(session.compactions.len(), 1);
        let compaction = &session.compactions[0];
        assert_eq!(compaction.before_model_call, 2);
        // The first reply would first have been sent at call 2, so it is in no call.
        assert_eq!(compaction.source_item_ids.len(), 1);
        let summary = session
            .context_items
            .iter()
            .find(|item| item.id == compaction.summary_item_id)
            .expect("summary");
        assert_eq!(summary.label, "Context reset · inferred from usage");
        assert_eq!(
            session.model_calls[1].compaction_before.as_deref(),
            Some(compaction.id.as_str())
        );
        assert_eq!(session.model_calls[1].context_item_ids.len(), 2);
        assert!(loaded
            .limitations
            .contains(&Limitation::InferredContextReset));

        let normal = reset_session(12_200);
        assert!(normal.session.compactions.is_empty());
        assert!(!normal
            .limitations
            .contains(&Limitation::InferredContextReset));
    }

    #[test]
    fn reasoning_reaches_the_next_turn_only_for_models_that_keep_it() {
        assert!(second_call_has_thinking(&two_turns("gpt-5.6-sol")));
        assert!(!second_call_has_thinking(&two_turns("gpt-5.5")));
    }
}
