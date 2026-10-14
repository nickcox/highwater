//! Turns a replayed session into model calls and context items. Section 5 of
//! plans/vscode-copilot-implementation-plan.md describes the rules.

use super::Limitation;
use crate::{
    domain::*,
    pi::reconstruct::{bounded_label, first_nonempty_line},
};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

pub(super) struct Reconstruction {
    pub session: NormalizedSession,
    pub limitations: BTreeSet<Limitation>,
}

struct State {
    items: Vec<NormalizedContextItem>,
    /// Items in context for the next call, in order.
    active: Vec<usize>,
    calls: Vec<NormalizedModelCall>,
    limitations: BTreeSet<Limitation>,
}

pub(super) fn reconstruct(
    session: &Value,
    working_directory: Option<String>,
) -> Result<Reconstruction, SourceError> {
    let id =
        text(session.get("sessionId")).ok_or(SourceError::RequiredField { field: "sessionId" })?;
    let requests = session
        .get("requests")
        .and_then(Value::as_array)
        .map_or(&[][..], Vec::as_slice);
    let version = requests
        .iter()
        .find_map(|request| text(request.pointer("/agent/extensionVersion")))
        .unwrap_or_else(|| "unknown".into());
    let mut state = State {
        items: Vec::new(),
        active: Vec::new(),
        calls: Vec::new(),
        limitations: [
            Limitation::MissingHistoricalSystemPrompt,
            Limitation::MissingHistoricalToolDefinitions,
            Limitation::UnrecordedHarnessCalls,
        ]
        .into(),
    };
    for (position, request) in requests.iter().enumerate() {
        state.apply_request(request, position)?;
    }
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

/// One model call: a round of a request, or a request that recorded no rounds.
struct Round<'a> {
    id: String,
    model: Option<String>,
    recorded_at_ms: Option<i64>,
    response: String,
    tool_calls: &'a [Value],
}

impl State {
    fn apply_request(&mut self, request: &Value, position: usize) -> Result<(), SourceError> {
        let request_id = text(request.get("requestId")).unwrap_or_else(|| format!("{position}"));
        let rounds = rounds(request, &request_id);
        if rounds.is_empty() {
            // A cancelled request with no response never reached a model.
            return Ok(());
        }
        let message = request
            .pointer("/message/text")
            .and_then(Value::as_str)
            .unwrap_or("");
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
            serialized_size_bytes: byte_length(message),
            payload: TokenizationPayload::UserMessage(MessageContent::text(message)),
            presence: Vec::new(),
            first_model_call: 0,
            last_model_call: 0,
        });
        for round in rounds {
            self.apply_round(&request_id, round);
        }
        Ok(())
    }

    fn apply_round(&mut self, request_id: &str, round: Round<'_>) {
        let index = self.calls.len() + 1;
        let context_item_ids = self
            .active
            .iter()
            .map(|item| self.items[*item].id.clone())
            .collect();
        for item in &self.active {
            extend_presence(&mut self.items[*item], index);
        }
        let mut blocks = Vec::new();
        if !round.response.is_empty() {
            blocks.push(AssistantContentBlock::Text(round.response.clone()));
        }
        let mut tool_calls_after = Vec::new();
        for tool_call in round.tool_calls {
            let Some(id) = text(tool_call.get("id")) else {
                self.limitations.insert(Limitation::UnsupportedContent);
                continue;
            };
            let name = text(tool_call.get("name")).unwrap_or_default();
            blocks.push(AssistantContentBlock::ToolCall {
                id: id.clone(),
                name: name.clone(),
                arguments: tool_call
                    .get("arguments")
                    .and_then(Value::as_str)
                    .unwrap_or("{}")
                    .to_owned(),
            });
            tool_calls_after.push(NormalizedToolCall {
                id,
                name,
                failed: false,
            });
        }
        self.calls.push(NormalizedModelCall {
            tool_loadout_known: false,
            index,
            source_record_id: format!("{request_id}:{}", round.id),
            target: ModelTarget {
                provider: Some("github-copilot".into()),
                model: round.model.clone(),
                api: None,
            },
            reported_usage: ReportedUsage::default(),
            stop_reason: None,
            timestamps: CallTimestamps {
                started_at_ms: None,
                recorded_at_ms: round.recorded_at_ms,
            },
            context_item_ids,
            tool_calls_after,
            compaction_before: None,
        });
        if blocks.is_empty() {
            return;
        }
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
                source_api: None,
                thinking_reported: false,
            },
            presence: Vec::new(),
            first_model_call: 0,
            last_model_call: 0,
        });
    }

    fn insert(&mut self, item: NormalizedContextItem) -> usize {
        let index = self.items.len();
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
            mut items, calls, ..
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
        let mut context_items: Vec<_> = items
            .into_iter()
            .filter(|item| !item.presence.is_empty())
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
            compactions: Vec::new(),
            lineage: Vec::new(),
        }
    }
}

/// The request's model calls, from `result.metadata.toolCallRounds`. A request that
/// recorded no rounds (older versions, or one still running) but has a response is one
/// call, whose response is the request's markdown.
fn rounds<'a>(request: &'a Value, request_id: &str) -> Vec<Round<'a>> {
    let metadata = request.pointer("/result/metadata");
    let request_model = model_name(
        metadata
            .and_then(|metadata| text(metadata.get("resolvedModel")))
            .or_else(|| text(request.get("modelId"))),
    );
    let recorded = metadata
        .and_then(|metadata| metadata.get("toolCallRounds"))
        .and_then(Value::as_array)
        .map_or(&[][..], Vec::as_slice);
    if !recorded.is_empty() {
        return recorded
            .iter()
            .enumerate()
            .map(|(position, round)| Round {
                id: text(round.get("id")).unwrap_or_else(|| format!("{position}")),
                model: model_name(text(round.get("modelId"))).or_else(|| request_model.clone()),
                recorded_at_ms: round.get("timestamp").and_then(Value::as_i64),
                response: round
                    .get("response")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_owned(),
                tool_calls: round
                    .get("toolCalls")
                    .and_then(Value::as_array)
                    .map_or(&[][..], Vec::as_slice),
            })
            .collect();
    }
    let response = markdown(request);
    if response.is_empty() && request.get("result").is_none() {
        return Vec::new();
    }
    vec![Round {
        id: format!("{request_id}:response"),
        model: request_model,
        recorded_at_ms: request
            .pointer("/modelState/completedAt")
            .and_then(Value::as_i64),
        response,
        tool_calls: &[],
    }]
}

/// `copilot/gpt-4.1` is `gpt-4.1`. `auto` names no model.
fn model_name(model: Option<String>) -> Option<String> {
    let model = model?;
    let model = model.strip_prefix("copilot/").unwrap_or(&model);
    (model != "auto" && !model.is_empty()).then(|| model.to_owned())
}

/// The response's markdown parts, which have no `kind` or `kind: "markdownContent"`.
fn markdown(request: &Value) -> String {
    request
        .get("response")
        .and_then(Value::as_array)
        .map_or(&[][..], Vec::as_slice)
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

fn byte_length(text: &str) -> u64 {
    u64::try_from(text.len()).unwrap_or(u64::MAX)
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
