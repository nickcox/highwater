use super::{change_log, discovery, load, Limitation};
use crate::domain::{
    AssistantContentBlock, ContentPart, ContextItemKind, SourceError, TokenizationPayload,
};
use serde_json::json;
use std::{fs, path::PathBuf};

fn user_dir() -> PathBuf {
    fs::canonicalize("fixtures/vscode-copilot/User").expect("fixture folder")
}

fn agent_session() -> PathBuf {
    user_dir().join("workspaceStorage/0a1b2c3d/chatSessions/11111111-agent.jsonl")
}

fn replay(text: &str) -> Result<change_log::Replayed, SourceError> {
    change_log::replay(text.as_bytes())
}

#[test]
fn replay_sets_appends_replaces_and_deletes() {
    let replayed = replay(concat!(
        r#"{"kind":0,"v":{"requests":[],"input":"draft"}}"#,
        "\n",
        r#"{"kind":2,"k":["requests"],"v":[{"id":1,"parts":["a","b"]}]}"#,
        "\n",
        r#"{"kind":2,"k":["requests",0,"parts"],"i":1,"v":["c"]}"#,
        "\n",
        r#"{"kind":1,"k":["requests",0,"done"],"v":true}"#,
        "\n",
        r#"{"kind":1,"k":["requests",1],"v":{"id":2}}"#,
        "\n",
        r#"{"kind":3,"k":["input"]}"#,
        "\n",
    ))
    .expect("replay");
    assert_eq!(replayed.changes, 6);
    assert_eq!(
        replayed.session,
        json!({"requests":[{"id":1,"parts":["a","c"],"done":true},{"id":2}]})
    );
}

#[test]
fn replay_skips_an_unfinished_last_line_only() {
    let replayed = replay(concat!(
        r#"{"kind":0,"v":{"requests":[]}}"#,
        "\n",
        r#"{"kind":2,"k":["requests"],"v":[{"#
    ))
    .expect("an unfinished line is still being written");
    assert_eq!(replayed.session, json!({"requests":[]}));
    assert!(matches!(
        replay(concat!(r#"{"kind":0,"v":{}}"#, "\n", "{not json\n")),
        Err(SourceError::Json { line: 2, .. })
    ));
}

#[test]
fn replay_rejects_changes_that_do_not_apply() {
    for text in [
        "",
        r#"{"kind":1,"k":["a"],"v":1}"#,
        concat!(r#"{"kind":0,"v":{}}"#, "\n", r#"{"kind":0,"v":{}}"#),
        concat!(
            r#"{"kind":0,"v":{}}"#,
            "\n",
            r#"{"kind":1,"k":["a","b"],"v":1}"#
        ),
        concat!(
            r#"{"kind":0,"v":{"a":[]}}"#,
            "\n",
            r#"{"kind":1,"k":["a",1],"v":1}"#
        ),
        concat!(
            r#"{"kind":0,"v":{"a":[1]}}"#,
            "\n",
            r#"{"kind":2,"k":["a"],"i":2,"v":[]}"#
        ),
        concat!(
            r#"{"kind":0,"v":{"a":1}}"#,
            "\n",
            r#"{"kind":2,"k":["a"],"v":[2]}"#
        ),
        concat!(r#"{"kind":0,"v":{}}"#, "\n", r#"{"kind":9,"k":["a"]}"#),
    ] {
        assert!(
            matches!(
                replay(&format!("{text}\n")),
                Err(SourceError::InvalidStructure(_))
            ),
            "{text}"
        );
    }
}

#[test]
fn workspace_uris_become_paths_unless_remote() {
    assert_eq!(
        discovery::folder_from_uri("file:///home/dev/my%20project"),
        "/home/dev/my project"
    );
    assert_eq!(
        discovery::folder_from_uri("file:///c%3A/Users/dev/app"),
        "c:/Users/dev/app"
    );
    assert_eq!(
        discovery::folder_from_uri("vscode-remote://ssh-remote%2Bbox/home/dev"),
        "vscode-remote://ssh-remote%2Bbox/home/dev"
    );
}

#[test]
fn finds_workspace_and_empty_window_sessions() {
    let files = discovery::find_files(&user_dir(), None).expect("discovery");
    let names: Vec<_> = files
        .iter()
        .map(|file| {
            file.path
                .file_name()
                .unwrap()
                .to_string_lossy()
                .into_owned()
        })
        .collect();
    assert_eq!(
        names,
        [
            "33333333-window.jsonl",
            "00000000-empty.jsonl",
            "11111111-agent.jsonl",
            "22222222-remote.jsonl"
        ]
    );
    assert!(files[0].workspace.is_none());
    assert!(files[1].workspace.is_some());
}

#[test]
fn listings_name_sessions_and_count_requests() {
    let files = discovery::find_files(&user_dir(), None).expect("discovery");
    let listings: Vec<_> = files
        .iter()
        .map(|file| discovery::read_listing(file).expect("listing"))
        .collect();
    assert_eq!(listings[1].requests, 0);
    assert_eq!(listings[2].requests, 3);
    assert_eq!(listings[2].session_id.as_deref(), Some("11111111-agent"));
    assert_eq!(
        listings[2].title.as_deref(),
        Some("Fix the failing parser test")
    );
    assert_eq!(
        listings[2].working_directory.as_deref(),
        Some("/home/dev/my project")
    );
    assert_eq!(listings[2].created_at_ms, Some(1_790_000_000_000));
    // Without a custom title, the first message names the session.
    assert_eq!(
        listings[0].title.as_deref(),
        Some("What does git rebase --onto do?")
    );
    assert_eq!(listings[0].working_directory, None);
    assert_eq!(
        listings[3].working_directory.as_deref(),
        Some("vscode-remote://ssh-remote%2Bbuildbox/home/dev/service")
    );
}

#[test]
fn listing_cache_rereads_only_changed_files() {
    let files = discovery::find_files(&user_dir(), None).expect("discovery");
    let mut cache = discovery::ListingCache::default();
    for file in &files {
        cache.listing(file).expect("listing");
    }
    for file in &files {
        cache.listing(file).expect("listing");
    }
    assert_eq!(cache.reads, files.len());
}

#[test]
fn each_round_is_a_model_call_and_a_cancelled_request_is_left_out() {
    let loaded = load(&agent_session()).expect("load");
    let session = &loaded.session;
    assert_eq!(session.id, "11111111-agent");
    assert_eq!(session.source.kind, "vscode-copilot");
    assert_eq!(session.source.version, "0.54.0");
    assert_eq!(
        session.title.as_deref(),
        Some("Fix the failing parser test")
    );
    assert_eq!(
        session.working_directory.as_deref(),
        Some("/home/dev/my project")
    );
    let models: Vec<_> = session
        .model_calls
        .iter()
        .map(|call| call.target.model.as_deref())
        .collect();
    assert_eq!(
        models,
        [
            Some("gpt-6-luna"),
            Some("gpt-6-luna"),
            Some("gpt-4.1-2025-04-14")
        ]
    );
    assert!(session
        .model_calls
        .iter()
        .all(|call| call.target.provider.as_deref() == Some("github-copilot")));
    let tools: Vec<_> = session.model_calls[0]
        .tool_calls_after
        .iter()
        .map(|tool| (tool.id.as_str(), tool.name.as_str()))
        .collect();
    assert_eq!(tools, [("call_read__vscode-1", "read_file")]);
    assert_eq!(
        session.model_calls[0].timestamps.recorded_at_ms,
        Some(1_790_000_002_000)
    );
    assert_eq!(loaded.records, 13);
    assert!(loaded
        .limitations
        .contains(&Limitation::MissingHistoricalSystemPrompt));
}

#[test]
fn a_call_sees_earlier_messages_responses_and_tool_results_but_not_its_own() {
    let session = load(&agent_session()).expect("load").session;
    let ids = |call: usize| session.model_calls[call].context_item_ids.clone();
    let first = [
        "vscode-copilot:context:request_1",
        "vscode-copilot:user:request_1",
    ];
    assert_eq!(ids(0), first);
    let second = [
        &first[..],
        &[
            "vscode-copilot:thinking:request_1:round-1",
            "vscode-copilot:assistant:request_1:round-1",
            "vscode-copilot:tool:call_read__vscode-1",
        ],
    ]
    .concat();
    assert_eq!(ids(1), second);
    let third = [
        &second[..],
        &[
            "vscode-copilot:assistant:request_1:round-2",
            "vscode-copilot:user:request_2",
        ],
    ]
    .concat();
    assert_eq!(ids(2), third);
    // The last response was never sent to a model.
    assert!(!session
        .context_items
        .iter()
        .any(|item| item.id.contains("request_2:")));
    let round_one = session
        .context_items
        .iter()
        .find(|item| item.id == "vscode-copilot:assistant:request_1:round-1")
        .expect("first round's response");
    assert_eq!(round_one.kind, ContextItemKind::AssistantMessage);
    assert_eq!(round_one.label, "Assistant · I'll read the parser first.");
    let TokenizationPayload::AssistantMessage {
        blocks,
        thinking_reported,
        ..
    } = &round_one.payload
    else {
        panic!("assistant payload");
    };
    assert!(*thinking_reported);
    assert!(matches!(
        &blocks[1],
        AssistantContentBlock::ToolCall { name, .. } if name == "read_file"
    ));
}

#[test]
fn the_message_as_sent_thinking_and_tool_results_become_items() {
    let session = load(&agent_session()).expect("load").session;
    let item = |id: &str| {
        session
            .context_items
            .iter()
            .find(|item| item.id == id)
            .unwrap_or_else(|| panic!("{id}"))
    };
    let user = item("vscode-copilot:user:request_1");
    assert_eq!(
        user.label,
        "User · Fix the failing parser test in src/parser.rs"
    );
    let TokenizationPayload::UserMessage(content) = &user.payload else {
        panic!("user payload");
    };
    // The rendered message, with its attachment; the cache marker is not content.
    assert_eq!(content.parts.len(), 1);
    assert!(
        matches!(&content.parts[0], ContentPart::Text(text) if text.starts_with("<attachments>"))
    );
    let context = item("vscode-copilot:context:request_1");
    assert_eq!(context.kind, ContextItemKind::CustomMessage);
    assert_eq!(context.label, "Workspace context");
    let thinking = item("vscode-copilot:thinking:request_1:round-1");
    assert_eq!(thinking.kind, ContextItemKind::Thinking);
    assert!(matches!(
        &thinking.payload,
        TokenizationPayload::ReportedThinking { tokens: 120, source_model: Some(model) } if model == "gpt-6-luna"
    ));
    let tool = item("vscode-copilot:tool:call_read__vscode-1");
    assert_eq!(tool.kind, ContextItemKind::ToolResult);
    assert_eq!(tool.label, "read_file result · src/parser.rs");
    assert_eq!(
        tool.metadata.get("toolName").map(String::as_str),
        Some("read_file")
    );
    let TokenizationPayload::ToolResult { content, .. } = &tool.payload else {
        panic!("tool result payload");
    };
    assert!(matches!(&content.parts[0], ContentPart::Text(text) if text == "fn parse() {}"));
}

#[test]
fn usage_is_the_requests_input_on_its_last_call_and_reasoning_per_round() {
    let session = load(&agent_session()).expect("load").session;
    let usage = |call: usize| &session.model_calls[call].reported_usage;
    assert_eq!(usage(0).input_total, None);
    assert_eq!(usage(0).reasoning, Some(120));
    assert_eq!(usage(1).input_total, Some(1800));
    // A request's output covers all its calls, so it is not given to one of two calls.
    assert_eq!(usage(1).output, None);
    assert_eq!(usage(1).input, None);
    assert_eq!(usage(1).cache_read, None);
    // A request with one call has that call's output.
    assert_eq!(usage(2).output, Some(42));
    assert_eq!(
        usage(2).output_reasoning_relationship,
        crate::domain::OutputReasoningRelationship::IncludesReasoning
    );
    assert_eq!(
        session.model_calls[1].target.api, None,
        "this round records no API"
    );
}

#[test]
fn attachments_without_the_message_as_sent_are_a_limitation() {
    let path = user_dir().join("workspaceStorage/4e5f6a7b/chatSessions/22222222-remote.jsonl");
    let loaded = load(&path).expect("load");
    assert!(loaded
        .limitations
        .contains(&Limitation::UnrenderedAttachments));
    assert_eq!(
        loaded.session.model_calls[0].reported_usage.output,
        Some(25)
    );
    assert!(!load(&agent_session())
        .expect("load")
        .limitations
        .contains(&Limitation::UnrenderedAttachments));
}

#[test]
fn a_request_without_rounds_uses_its_markdown_response() {
    let path = user_dir().join("workspaceStorage/4e5f6a7b/chatSessions/22222222-remote.jsonl");
    let loaded = load(&path).expect("load");
    let session = loaded.session;
    // The second request was stopped after several calls; they are recorded as one.
    assert_eq!(session.model_calls.len(), 2);
    assert!(loaded.limitations.contains(&Limitation::UnrecordedRounds));
    let combined = &session.model_calls[1].reported_usage;
    assert_eq!(combined.input_total, Some(900));
    assert_eq!(combined.output, None, "the output covers every call");
    assert_eq!(
        session.model_calls[0].target.model.as_deref(),
        Some("claude-haiku-5.5")
    );
    assert_eq!(
        session.working_directory.as_deref(),
        Some("vscode-remote://ssh-remote%2Bbuildbox/home/dev/service")
    );
    let window =
        load(&user_dir().join("globalStorage/emptyWindowChatSessions/33333333-window.jsonl"))
            .expect("load")
            .session;
    assert_eq!(window.working_directory, None);
    assert_eq!(window.title, None);
    // The second request failed with an error before any response.
    assert_eq!(window.model_calls.len(), 1);
    assert!(!window
        .context_items
        .iter()
        .any(|item| item.id.contains("request_w2")));
}
