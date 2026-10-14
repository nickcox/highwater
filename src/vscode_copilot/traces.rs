//! Reads one session's records from Copilot's trace database, read-only. See
//! plans/vscode-copilot-analysis-notes.md, "Trace database".

use crate::domain::MAX_SAFE_JSON_INTEGER;
use rusqlite::{limits::Limit, Connection, OpenFlags};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    time::Duration,
};

const BUSY_TIMEOUT: Duration = Duration::from_millis(250);
const MAX_SQLITE_VALUE_BYTES: i32 = 32 * 1024 * 1024;
/// Model calls of a chat request in agent mode, including retried ones.
const AGENTS: [&str; 2] = ["panel/editAgent", "retry-error-panel/editAgent"];
const ATTRIBUTES: [&str; 10] = [
    "copilot_chat.copilot_usage_nano_aiu",
    "gen_ai.input.messages",
    "gen_ai.response.id",
    "gen_ai.usage.cache_creation.input_tokens",
    "copilot_chat.request.shape",
    "gen_ai.system_instructions",
    "gen_ai.tool.definitions",
    "gen_ai.output.messages",
    "gen_ai.response.finish_reasons",
    "gen_ai.tool.call.result",
];

/// The trace database beside a session file: `<user>/globalStorage/github.copilot-chat/
/// agent-traces.db`, where the session is in `<user>/workspaceStorage/<workspace>/
/// chatSessions` or `<user>/globalStorage/emptyWindowChatSessions`.
pub(crate) fn database_for(session: &Path) -> Option<PathBuf> {
    let folder = session.parent()?;
    let user = match folder.file_name()?.to_str()? {
        "chatSessions" => folder.parent()?.parent()?.parent()?,
        "emptyWindowChatSessions" => folder.parent()?.parent()?,
        _ => return None,
    };
    Some(user.join("globalStorage/github.copilot-chat/agent-traces.db"))
}

/// A fingerprint of the trace database and its write-ahead log: their sizes and
/// modification times. A session's analysis is out of date when it changes.
pub(crate) fn fingerprint(database: &Path) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new();
    for path in [database.to_path_buf(), database.with_extension("db-wal")] {
        match std::fs::metadata(&path) {
            Ok(metadata) => {
                hasher.update(&metadata.len().to_le_bytes());
                let modified = metadata
                    .modified()
                    .ok()
                    .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                    .map_or(0, |duration| duration.as_nanos());
                hasher.update(&modified.to_le_bytes());
            }
            Err(_) => {
                hasher.update(b"missing");
            }
        }
    }
    *hasher.finalize().as_bytes()
}

/// One model call.
#[derive(Debug, Clone, Default)]
pub(crate) struct TraceCall {
    pub span_id: String,
    /// Recorded as `retry-error-panel/editAgent`.
    pub retry: bool,
    /// What Copilot charged for the call, in billionths of a credit.
    pub usage_nano_credits: Option<u64>,
    pub started_at_ms: i64,
    pub ended_at_ms: i64,
    pub model: Option<String>,
    /// `openai-responses` or `anthropic-messages`, from the request's shape.
    pub api: Option<String>,
    pub response_id: Option<String>,
    /// Total input, including cache reads and writes.
    pub input: Option<u64>,
    pub cache_read: Option<u64>,
    pub cache_write: Option<u64>,
    pub output: Option<u64>,
    pub reasoning: Option<u64>,
    pub finish_reason: Option<String>,
    /// The system instructions' text, when the call recorded them.
    pub system: Option<String>,
    /// Each tool definition by name, as recorded JSON, when the call recorded them.
    pub tools: Option<Vec<(String, String)>>,
    pub output_text: String,
    /// `(id, name, arguments)` of the tool calls in the response.
    pub tool_calls: Vec<(String, String, String)>,
    /// A `<conversation-summary>` in the call's input: Copilot replaced the older part of the
    /// conversation with it.
    pub summary: Option<String>,
    /// IDs of the tool calls and tool results in the call's input.
    pub input_tool_call_ids: HashSet<String>,
    /// Tool results in the call's input, by tool-call ID, as the model was sent them.
    input_tool_results: Vec<(String, String)>,
}

#[derive(Debug, Default)]
pub(crate) struct Traces {
    /// In start order.
    pub calls: Vec<TraceCall>,
    /// Tool results by tool-call ID, as the tool returned them.
    pub tool_results: HashMap<String, String>,
    /// Tool results by tool-call ID as a later call's input sent them to the model. Copilot
    /// can shorten a result (a long terminal output, for example) before sending it.
    pub sent_tool_results: HashMap<String, String>,
}

#[derive(Debug, thiserror::Error)]
pub(crate) enum TraceError {
    #[error("the trace database cannot be read")]
    Database(#[from] rusqlite::Error),
    #[error("the trace database layout is not supported")]
    UnsupportedLayout,
}

/// `Ok(None)` when the database does not exist. Never writes, and never opens with
/// `immutable=1`, which would ignore recent records in the write-ahead log.
pub(crate) fn load(database: &Path, session_id: &str) -> Result<Option<Traces>, TraceError> {
    if !database.is_file() {
        return Ok(None);
    }
    let connection = Connection::open_with_flags(
        database,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    connection.busy_timeout(BUSY_TIMEOUT)?;
    connection.set_limit(Limit::SQLITE_LIMIT_LENGTH, MAX_SQLITE_VALUE_BYTES)?;
    for (table, columns) in [
        (
            "spans",
            &[
                "span_id",
                "start_time_ms",
                "end_time_ms",
                "operation_name",
                "agent_name",
                "chat_session_id",
                "response_model",
                "input_tokens",
                "output_tokens",
                "cached_tokens",
                "reasoning_tokens",
                "tool_call_id",
            ][..],
        ),
        ("span_attributes", &["span_id", "key", "value"][..]),
    ] {
        let present: HashSet<String> = connection
            .prepare("SELECT name FROM pragma_table_info(?1)")?
            .query_map([table], |row| row.get(0))?
            .collect::<Result<_, _>>()?;
        if !columns.iter().all(|column| present.contains(*column)) {
            return Err(TraceError::UnsupportedLayout);
        }
    }
    // One read transaction, so the spans and their attributes come from one state.
    connection.execute_batch("BEGIN")?;
    let result = read(&connection, session_id);
    // A read transaction has nothing to commit; ending it only releases the snapshot.
    let _ = connection.execute_batch("COMMIT");
    result.map(Some)
}

/// Span times are stored in milliseconds, sometimes with a fraction.
fn instant(value: f64) -> i64 {
    if value.is_finite() && value.abs() <= MAX_SAFE_JSON_INTEGER as f64 {
        value.round() as i64
    } else {
        0
    }
}

fn counter(value: Option<i64>) -> Option<u64> {
    value
        .and_then(|value| u64::try_from(value).ok())
        .filter(|value| *value <= MAX_SAFE_JSON_INTEGER)
}

fn read(connection: &Connection, session_id: &str) -> Result<Traces, TraceError> {
    let mut statement = connection.prepare(
        "SELECT span_id, start_time_ms, end_time_ms, operation_name, agent_name, response_model,
                input_tokens, output_tokens, cached_tokens, reasoning_tokens, tool_call_id
         FROM spans
         WHERE chat_session_id = ?1
           AND (operation_name = 'execute_tool'
                OR (operation_name = 'chat' AND agent_name IN (?2, ?3)))
         ORDER BY start_time_ms, span_id",
    )?;
    let mut calls = Vec::new();
    let mut tool_spans = Vec::new();
    let mut rows = statement.query((session_id, AGENTS[0], AGENTS[1]))?;
    while let Some(row) = rows.next()? {
        let span_id: String = row.get(0)?;
        if row.get::<_, Option<String>>(3)?.as_deref() == Some("execute_tool") {
            if let Some(id) = row.get::<_, Option<String>>(10)? {
                tool_spans.push((span_id, id));
            }
            continue;
        }
        calls.push(TraceCall {
            span_id,
            retry: row.get::<_, Option<String>>(4)?.as_deref() == Some(AGENTS[1]),
            started_at_ms: instant(row.get(1)?),
            ended_at_ms: instant(row.get(2)?),
            model: row.get(5)?,
            input: counter(row.get(6)?),
            output: counter(row.get(7)?),
            cache_read: counter(row.get(8)?),
            reasoning: counter(row.get(9)?),
            ..TraceCall::default()
        });
    }
    let attributes = attributes(
        connection,
        calls
            .iter()
            .map(|call| call.span_id.as_str())
            .chain(tool_spans.iter().map(|(span, _)| span.as_str())),
    )?;
    for call in &mut calls {
        let Some(values) = attributes.get(&call.span_id) else {
            continue;
        };
        apply_attributes(call, values);
    }
    let mut sent_tool_results = HashMap::new();
    for call in &mut calls {
        for (id, response) in std::mem::take(&mut call.input_tool_results) {
            sent_tool_results.entry(id).or_insert(response);
        }
    }
    let tool_results = tool_spans
        .into_iter()
        .filter_map(|(span, id)| {
            let result = attributes.get(&span)?.get("gen_ai.tool.call.result")?;
            Some((id, result.clone()))
        })
        .collect();
    Ok(Traces {
        calls,
        tool_results,
        sent_tool_results,
    })
}

fn attributes<'a>(
    connection: &Connection,
    spans: impl Iterator<Item = &'a str>,
) -> Result<HashMap<String, HashMap<String, String>>, TraceError> {
    let mut statement = connection.prepare(
        "SELECT key, value FROM span_attributes WHERE span_id = ?1 AND key IN (?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
    )?;
    let mut output = HashMap::new();
    for span in spans {
        let mut values = HashMap::new();
        let mut rows = statement.query((
            span,
            ATTRIBUTES[0],
            ATTRIBUTES[1],
            ATTRIBUTES[2],
            ATTRIBUTES[3],
            ATTRIBUTES[4],
            ATTRIBUTES[5],
            ATTRIBUTES[6],
            ATTRIBUTES[7],
            ATTRIBUTES[8],
            ATTRIBUTES[9],
        ))?;
        while let Some(row) = rows.next()? {
            if let Some(value) = row.get::<_, Option<String>>(1)? {
                values.insert(row.get(0)?, value);
            }
        }
        output.insert(span.to_owned(), values);
    }
    Ok(output)
}

/// The `<conversation-summary>` block in a text, tags included.
fn conversation_summary(text: &str) -> Option<String> {
    const OPEN: &str = "<conversation-summary>";
    const CLOSE: &str = "</conversation-summary>";
    let start = text.find(OPEN)?;
    let end = text[start..]
        .find(CLOSE)
        .map_or(text.len(), |end| start + end + CLOSE.len());
    Some(text[start..end].to_owned())
}

fn apply_attributes(call: &mut TraceCall, values: &HashMap<String, String>) {
    let json = |key: &str| {
        values
            .get(key)
            .and_then(|value| serde_json::from_str::<Value>(value).ok())
    };
    call.response_id = values.get("gen_ai.response.id").cloned();
    call.usage_nano_credits = values
        .get("copilot_chat.copilot_usage_nano_aiu")
        .and_then(|value| value.parse().ok());
    call.cache_write = values
        .get("gen_ai.usage.cache_creation.input_tokens")
        .and_then(|value| value.parse().ok())
        .filter(|value| *value <= MAX_SAFE_JSON_INTEGER);
    call.api = json("copilot_chat.request.shape").and_then(|shape| {
        match shape.get("api").and_then(Value::as_str) {
            Some("responses") => Some("openai-responses".into()),
            Some("messages") => Some("anthropic-messages".into()),
            _ => None,
        }
    });
    call.finish_reason = json("gen_ai.response.finish_reasons")
        .and_then(|reasons| reasons.get(0)?.as_str().map(str::to_owned));
    call.system = json("gen_ai.system_instructions").and_then(|parts| {
        let text: Vec<&str> = parts
            .as_array()?
            .iter()
            .filter_map(|part| part.get("content").and_then(Value::as_str))
            .collect();
        (!text.is_empty()).then(|| text.join("\n"))
    });
    call.tools = json("gen_ai.tool.definitions").and_then(|tools| {
        tools
            .as_array()?
            .iter()
            .map(|tool| {
                let name = tool.get("name")?.as_str()?.to_owned();
                Some((name, tool.to_string()))
            })
            .collect()
    });
    if let Some(messages) = json("gen_ai.input.messages") {
        for part in messages
            .as_array()
            .into_iter()
            .flatten()
            .flat_map(|message| message.get("parts").and_then(Value::as_array))
            .flatten()
        {
            match part.get("type").and_then(Value::as_str) {
                Some(kind @ ("tool_call" | "tool_call_response")) => {
                    let Some(id) = part.get("id").and_then(Value::as_str) else {
                        continue;
                    };
                    call.input_tool_call_ids.insert(id.to_owned());
                    if kind == "tool_call_response" {
                        let response = match part.get("response") {
                            Some(Value::String(text)) => text.clone(),
                            Some(other) => other.to_string(),
                            None => continue,
                        };
                        call.input_tool_results.push((id.to_owned(), response));
                    }
                }
                Some("text") if call.summary.is_none() => {
                    let text = part.get("content").and_then(Value::as_str).unwrap_or("");
                    call.summary = conversation_summary(text);
                }
                _ => {}
            }
        }
    }
    if let Some(messages) = json("gen_ai.output.messages") {
        for part in messages
            .as_array()
            .into_iter()
            .flatten()
            .flat_map(|message| message.get("parts").and_then(Value::as_array))
            .flatten()
        {
            let text = |key: &str| part.get(key).and_then(Value::as_str).unwrap_or("");
            match part.get("type").and_then(Value::as_str) {
                Some("text") => call.output_text.push_str(text("content")),
                Some("tool_call") => call.tool_calls.push((
                    text("id").to_owned(),
                    text("name").to_owned(),
                    match part.get("arguments") {
                        Some(Value::String(arguments)) => arguments.clone(),
                        Some(arguments) => arguments.to_string(),
                        None => "{}".into(),
                    },
                )),
                _ => {}
            }
        }
    }
}
