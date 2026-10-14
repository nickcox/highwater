//! Sessions read together with a trace database built in a temporary user folder, with
//! the tables Copilot writes. All records are made up.

use super::{load, Limitation, Loaded};
use crate::domain::{ContentPart, ContextItemKind, TokenizationPayload};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::{fs, path::Path};

/// A chat or tool span, with the attributes the reader uses.
struct Span {
    id: &'static str,
    session: &'static str,
    start: i64,
    operation: &'static str,
    agent: Option<&'static str>,
    model: Option<&'static str>,
    input: Option<i64>,
    output: Option<i64>,
    cached: Option<i64>,
    reasoning: Option<i64>,
    tool_call_id: Option<&'static str>,
    attributes: Vec<(&'static str, String)>,
}

fn chat(id: &'static str, session: &'static str, start: i64, model: &'static str) -> Span {
    Span {
        id,
        session,
        start,
        operation: "chat",
        agent: Some("panel/editAgent"),
        model: Some(model),
        input: None,
        output: None,
        cached: None,
        reasoning: None,
        tool_call_id: None,
        attributes: Vec::new(),
    }
}

fn tool(
    id: &'static str,
    session: &'static str,
    start: i64,
    call: &'static str,
    result: &str,
) -> Span {
    Span {
        operation: "execute_tool",
        agent: None,
        model: None,
        tool_call_id: Some(call),
        attributes: vec![("gen_ai.tool.call.result", result.to_owned())],
        ..chat(id, session, start, "")
    }
}

fn write_database(path: &Path, spans: &[Span]) {
    fs::create_dir_all(path.parent().expect("folder")).expect("folder");
    let connection = Connection::open(path).expect("database");
    connection
        .execute_batch(
            "CREATE TABLE spans (
                span_id TEXT PRIMARY KEY, trace_id TEXT NOT NULL, parent_span_id TEXT,
                name TEXT NOT NULL, start_time_ms INTEGER NOT NULL, end_time_ms INTEGER NOT NULL,
                status_code INTEGER NOT NULL DEFAULT 0, status_message TEXT,
                operation_name TEXT, provider_name TEXT, agent_name TEXT, conversation_id TEXT,
                request_model TEXT, response_model TEXT,
                input_tokens INTEGER, output_tokens INTEGER, cached_tokens INTEGER, reasoning_tokens INTEGER,
                tool_name TEXT, tool_call_id TEXT, tool_type TEXT,
                chat_session_id TEXT, turn_index INTEGER, ttft_ms REAL);
             CREATE TABLE span_attributes (span_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT,
                PRIMARY KEY (span_id, key));",
        )
        .expect("schema");
    for span in spans {
        connection
            .execute(
                "INSERT INTO spans (span_id, trace_id, name, start_time_ms, end_time_ms, operation_name,
                    agent_name, chat_session_id, request_model, response_model, input_tokens,
                    output_tokens, cached_tokens, reasoning_tokens, tool_call_id)
                 VALUES (?1, 'trace', ?2, ?3, ?4, ?2, ?5, ?6, ?7, ?7, ?8, ?9, ?10, ?11, ?12)",
                (
                    span.id,
                    span.operation,
                    span.start,
                    // Copilot stores end times with a fraction.
                    span.start as f64 + 1500.25,
                    span.agent,
                    span.session,
                    span.model,
                    span.input,
                    span.output,
                    span.cached,
                    span.reasoning,
                    span.tool_call_id,
                ),
            )
            .expect("span");
        for (key, value) in &span.attributes {
            connection
                .execute(
                    "INSERT INTO span_attributes (span_id, key, value) VALUES (?1, ?2, ?3)",
                    (span.id, key, value),
                )
                .expect("attribute");
        }
    }
}

/// A user folder holding `session` (change lines) and a trace database of `spans`.
fn user_folder(session: &[Value], spans: &[Span]) -> (tempfile::TempDir, std::path::PathBuf) {
    let directory = tempfile::tempdir().expect("temporary folder");
    let user = directory.path().join("User");
    let sessions = user.join("workspaceStorage/abc/chatSessions");
    fs::create_dir_all(&sessions).expect("sessions");
    fs::write(
        user.join("workspaceStorage/abc/workspace.json"),
        r#"{"folder":"file:///home/dev/project"}"#,
    )
    .expect("workspace");
    let path = sessions.join("session.jsonl");
    let lines: Vec<String> = session.iter().map(Value::to_string).collect();
    fs::write(&path, lines.join("\n") + "\n").expect("session file");
    if !spans.is_empty() {
        write_database(
            &user.join("globalStorage/github.copilot-chat/agent-traces.db"),
            spans,
        );
    }
    (directory, path)
}

fn start(session: &str) -> Value {
    json!({"kind":0,"v":{"sessionId":session,"creationDate":1,"requests":[]}})
}

fn request(id: &str, timestamp: i64, model: &str, text: &str) -> Value {
    json!({"requestId":id,"timestamp":timestamp,"modelId":model,
        "agent":{"extensionVersion":"0.69.0"},"message":{"text":text},"response":[]})
}

/// A GPT request with two rounds, the first calling `read_file`.
fn gpt_session() -> Vec<Value> {
    vec![
        start("gpt"),
        json!({"kind":2,"k":["requests"],"v":[request("request_1", 1_000, "copilot/auto", "Read the parser")]}),
        json!({"kind":1,"k":["requests",0,"result"],"v":{"metadata":{
            "responseId":"response-1","promptTokens":2000,
            "toolCallRounds":[
                {"id":"round-1","modelId":"gpt-6-luna","toolCalls":[{"id":"call_read__vscode-7","name":"read_file","arguments":"{}"}]},
                {"id":"round-2","modelId":"gpt-6-luna","response":"Done.","toolCalls":[]}],
            "toolCallResults":{"call_read__vscode-7":{"content":[{"value":"fn parse() {}"}]}}}}}),
        json!({"kind":2,"k":["requests"],"v":[request("request_2", 9_000, "copilot/gpt-4.1", "Thanks")]}),
        json!({"kind":2,"k":["requests",1,"response"],"v":[{"value":"You're welcome."}]}),
        json!({"kind":1,"k":["requests",1,"result"],"v":{"metadata":{"responseId":"response-2"}}}),
    ]
}

fn gpt_spans(tool_call: &'static str) -> Vec<Span> {
    let shape = json!({"api":"responses"}).to_string();
    let tools =
        json!([{"type":"function","name":"read_file","description":"Read a file","parameters":{}}])
            .to_string();
    let system = json!([{"type":"text","content":"You are an agent."}]).to_string();
    vec![
        Span {
            input: Some(1800),
            cached: Some(1500),
            output: Some(60),
            reasoning: Some(20),
            agent: Some("retry-error-panel/editAgent"),
            attributes: vec![
                ("copilot_chat.copilot_usage_nano_aiu", "454055500".into()),
                ("gen_ai.response.id", "response-1".into()),
                ("copilot_chat.request.shape", shape.clone()),
                ("gen_ai.system_instructions", system),
                ("gen_ai.tool.definitions", tools.clone()),
                (
                    "gen_ai.output.messages",
                    json!([{"role":"assistant","parts":[{"type":"tool_call","id":tool_call,"name":"read_file","arguments":"{}"}]}]).to_string(),
                ),
            ],
            ..chat("span-1", "gpt", 1_100, "gpt-6-luna")
        },
        tool("span-tool", "gpt", 2_700, "call_read", "fn parse() {}"),
        Span {
            input: Some(2000),
            cached: Some(1800),
            output: Some(10),
            attributes: vec![
                ("gen_ai.response.id", "response-1".into()),
                ("copilot_chat.request.shape", shape),
                // A continuation of the previous response repeats the tools but not the
                // instructions.
                ("gen_ai.tool.definitions", tools),
            ],
            ..chat("span-2", "gpt", 3_000, "gpt-6-luna")
        },
    ]
}

fn loaded(path: &Path) -> Loaded {
    load(path).expect("load")
}

#[test]
fn trace_records_give_matched_calls_their_usage_timing_and_loadout() {
    let (_directory, path) = user_folder(&gpt_session(), &gpt_spans("call_read"));
    let loaded = loaded(&path);
    let calls = &loaded.session.model_calls;
    assert_eq!(calls.len(), 3);
    let usage = &calls[0].reported_usage;
    assert_eq!(
        (usage.input, usage.cache_read, usage.cache_write),
        (Some(300), Some(1500), Some(0))
    );
    assert_eq!((usage.output, usage.reasoning), (Some(60), Some(20)));
    assert_eq!(calls[0].timestamps.started_at_ms, Some(1_100));
    assert_eq!(calls[0].timestamps.recorded_at_ms, Some(2_600));
    assert_eq!(calls[0].target.api.as_deref(), Some("openai-responses"));
    assert!(calls[0].tool_loadout_known);
    // The second call carries the system prompt from the response it continues.
    assert!(calls[1].tool_loadout_known);
    assert_eq!(
        calls[0].context_item_ids[..2],
        calls[1].context_item_ids[..2]
    );
    let item = |id: &str| {
        loaded
            .session
            .context_items
            .iter()
            .find(|item| item.id == id)
            .unwrap_or_else(|| panic!("{id}"))
    };
    assert_eq!(
        item(&calls[0].context_item_ids[0]).kind,
        ContextItemKind::System
    );
    assert_eq!(
        item(&calls[0].context_item_ids[1]).label,
        "read_file definition"
    );
    // The last request has no trace records, so it uses the session file alone.
    assert!(!calls[2].tool_loadout_known);
    assert_eq!(calls[2].timestamps.started_at_ms, None);
    for limitation in [
        Limitation::TraceRecordsIncomplete,
        Limitation::MissingHistoricalSystemPrompt,
    ] {
        assert!(loaded.limitations.contains(&limitation), "{limitation:?}");
    }
}

#[test]
fn trace_records_that_do_not_match_the_rounds_are_not_used() {
    let (_directory, path) = user_folder(&gpt_session(), &gpt_spans("call_other"));
    let loaded = loaded(&path);
    assert!(loaded
        .session
        .model_calls
        .iter()
        .all(|call| call.timestamps.started_at_ms.is_none()));
    assert!(loaded
        .limitations
        .contains(&Limitation::TraceRecordsIncomplete));
}

#[test]
fn an_unreadable_trace_database_is_a_limitation() {
    let (directory, path) = user_folder(&gpt_session(), &[]);
    let database = directory
        .path()
        .join("User/globalStorage/github.copilot-chat/agent-traces.db");
    fs::create_dir_all(database.parent().unwrap()).unwrap();
    fs::write(&database, "not a database").unwrap();
    let loaded = loaded(&path);
    assert!(loaded
        .limitations
        .contains(&Limitation::TraceRecordsUnreadable));
    assert_eq!(loaded.session.model_calls.len(), 3);
}

/// A Claude request stopped after three calls: it recorded no rounds, and Copilot
/// summarised the conversation before the third call.
fn claude_session() -> Vec<Value> {
    vec![
        start("claude"),
        json!({"kind":2,"k":["requests"],"v":[{
            "requestId":"request_c","timestamp":1_000,"modelId":"copilot/claude-haiku-5.5",
            "agent":{"extensionVersion":"0.69.0"},"message":{"text":"Tidy the docs"},
            "response":[{"kind":"toolInvocationSerialized"},{"value":"Working on it"}],
            "promptTokens":3000,"completionTokens":400}]}),
        json!({"kind":1,"k":["requests",0,"result"],"v":{}}),
    ]
}

fn claude_spans() -> Vec<Span> {
    let shape = json!({"api":"messages"}).to_string();
    let tools = json!([
        {"type":"function","name":"read_file","description":"Read a file","parameters":{}},
        {"type":"function","name":"tool_search","description":"Find deferred tools","parameters":{}},
        {"type":"function","name":"mcp_jira_search","description":"Search Jira","parameters":{}}
    ])
    .to_string();
    let system = json!([{"type":"text","content":"You are an agent."}]).to_string();
    let user = json!({"role":"user","parts":[{"type":"text","content":"Tidy the docs"}]});
    let first_call = json!({"role":"assistant","parts":[{"type":"tool_call","id":"toolu_1","name":"run_in_terminal","arguments":"{}"}]});
    let first_result = json!({"role":"user","parts":[{"type":"tool_call_response","id":"toolu_1","response":"3 files"}]});
    let base = |id, start, input, output_messages: Value, input_messages: Value| Span {
        input: Some(input),
        cached: Some(0),
        output: Some(100),
        attributes: vec![
            ("copilot_chat.request.shape", shape.clone()),
            ("gen_ai.system_instructions", system.clone()),
            ("gen_ai.tool.definitions", tools.clone()),
            ("gen_ai.usage.cache_creation.input_tokens", "500".into()),
            ("gen_ai.output.messages", output_messages.to_string()),
            ("gen_ai.input.messages", input_messages.to_string()),
        ],
        ..chat(id, "claude", start, "claude-haiku-5.5")
    };
    vec![
        base(
            "c1",
            1_100,
            1000,
            json!([{"role":"assistant","parts":[{"type":"text","content":"Listing."},{"type":"tool_call","id":"toolu_1","name":"run_in_terminal","arguments":"{\"command\":\"ls\"}"}]}]),
            json!([user]),
        ),
        tool(
            "c1-tool",
            "claude",
            2_700,
            "toolu_1",
            "3 files\na.md\nb.md\nc.md and a very long listing",
        ),
        base(
            "c2",
            3_000,
            1200,
            json!([{"role":"assistant","parts":[{"type":"text","content":"Reading."},{"type":"tool_call","id":"toolu_2","name":"read_file","arguments":"{}"}]}]),
            json!([user, first_call, first_result]),
        ),
        tool("c2-tool", "claude", 4_600, "toolu_2", "# Docs"),
        base(
            "c3",
            5_000,
            900,
            json!([{"role":"assistant","parts":[{"type":"text","content":"Done."}]}]),
            json!([
                {"role":"user","parts":[{"type":"text","content":"<conversation-summary>The user asked to tidy the docs; ls found three files.</conversation-summary>"}]},
                {"role":"assistant","parts":[{"type":"tool_call","id":"toolu_2","name":"read_file","arguments":"{}"}]},
                {"role":"user","parts":[{"type":"tool_call_response","id":"toolu_2","response":"# Docs"}]}
            ]),
        ),
    ]
}

#[test]
fn a_stopped_request_is_split_into_its_traced_calls() {
    let (_directory, path) = user_folder(&claude_session(), &claude_spans());
    let loaded = loaded(&path);
    let session = &loaded.session;
    assert_eq!(session.model_calls.len(), 3);
    assert!(!loaded.limitations.contains(&Limitation::UnrecordedRounds));
    let usage = &session.model_calls[0].reported_usage;
    assert_eq!(
        (usage.input, usage.cache_read, usage.cache_write),
        (Some(500), Some(0), Some(500))
    );
    assert_eq!(
        session.model_calls[0].tool_calls_after[0].name,
        "run_in_terminal"
    );
}

#[test]
fn deferred_tools_are_not_in_context() {
    let (_directory, path) = user_folder(&claude_session(), &claude_spans());
    let session = loaded(&path).session;
    let tools: Vec<&str> = session
        .context_items
        .iter()
        .filter(|item| item.kind == ContextItemKind::ToolDefinition)
        .map(|item| item.metadata["toolName"].as_str())
        .collect();
    assert_eq!(tools, ["read_file", "tool_search"]);
}

#[test]
fn a_tool_result_is_the_text_the_model_was_sent() {
    let (_directory, path) = user_folder(&claude_session(), &claude_spans());
    let session = loaded(&path).session;
    let result = session
        .context_items
        .iter()
        .find(|item| item.source_tool_call_id.as_deref() == Some("toolu_1"))
        .expect("first tool result");
    let TokenizationPayload::ToolResult { content, .. } = &result.payload else {
        panic!("tool result payload");
    };
    assert!(matches!(&content.parts[0], ContentPart::Text(text) if text == "3 files"));
}

#[test]
fn a_conversation_summary_in_a_calls_input_is_a_compaction() {
    let (_directory, path) = user_folder(&claude_session(), &claude_spans());
    let session = loaded(&path).session;
    assert_eq!(session.compactions.len(), 1);
    let compaction = &session.compactions[0];
    assert_eq!(compaction.before_model_call, 3);
    assert_eq!(
        session.model_calls[2].compaction_before.as_deref(),
        Some(compaction.id.as_str())
    );
    let summary = session
        .context_items
        .iter()
        .find(|item| item.id == compaction.summary_item_id)
        .expect("summary");
    assert_eq!(summary.kind, ContextItemKind::CompactionSummary);
    // The first tool call and its result were summarised; the second was kept.
    let third = &session.model_calls[2].context_item_ids;
    assert!(third.contains(&compaction.summary_item_id));
    assert!(!third.iter().any(|id| id.ends_with("toolu_1")));
    assert!(third.iter().any(|id| id.ends_with("toolu_2")));
    assert!(compaction
        .source_item_ids
        .iter()
        .any(|id| id.ends_with("toolu_1")));
    assert!(session
        .lineage
        .iter()
        .all(|edge| edge.to == compaction.summary_item_id));
}

#[test]
fn a_traced_call_has_the_cost_copilot_recorded_and_its_retry() {
    let (_directory, path) = user_folder(&gpt_session(), &gpt_spans("call_read"));
    let calls = loaded(&path).session.model_calls;
    let cost = calls[0].reported_usage.cost.total.expect("recorded cost");
    assert!((cost - 0.004_540_555).abs() < 1e-12);
    assert!(calls[0].retried);
    assert!(!calls[1].retried);
    assert_eq!(calls[1].reported_usage.cost.total, None);
}
