use super::discovery::{find_files, parse_workspace, read_listing, ListingCache};
use crate::{
    claude_code::Limitation,
    domain::{ContextItemKind, NormalizedSession},
};
use std::{fs, path::PathBuf};

fn home() -> PathBuf {
    fs::canonicalize("fixtures/copilot/home").expect("fixture home")
}

fn session_id(number: &str) -> String {
    format!("1c000000-0000-4000-8000-000000000{number}")
}

fn events(number: &str) -> PathBuf {
    home()
        .join("session-state")
        .join(session_id(number))
        .join("events.jsonl")
}

fn load(number: &str) -> super::Loaded {
    super::load(&events(number)).expect("loads")
}

fn labels(session: &NormalizedSession, call: usize) -> Vec<String> {
    session.model_calls[call]
        .context_item_ids
        .iter()
        .map(|id| {
            session
                .context_items
                .iter()
                .find(|item| item.id == *id)
                .map(|item| item.label.clone())
                .unwrap_or_else(|| panic!("{id} is not an item"))
        })
        .collect()
}

#[test]
fn discovery_finds_session_folders_with_an_event_log() {
    let names: Vec<String> = find_files(&home(), None)
        .expect("discovery")
        .iter()
        .map(|file| {
            file.path
                .parent()
                .and_then(|folder| folder.file_name())
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_default()
        })
        .collect();
    assert_eq!(
        names,
        [session_id("001"), session_id("002"), session_id("003")]
    );
}

#[test]
fn listings_read_the_workspace_and_whether_a_call_reported_usage() {
    let files = find_files(&home(), None).expect("discovery");
    let app = read_listing(&files[0]).expect("app");
    assert!(app.has_responses);
    assert_eq!(app.workspace.id, Some(session_id("001")));
    assert_eq!(
        app.workspace.name.as_deref(),
        Some("Synthetic: app session")
    );
    assert_eq!(app.workspace.cwd.as_deref(), Some("/synthetic/project"));
    assert_eq!(
        app.workspace.client_name.as_deref(),
        Some("github/autopilot")
    );
    assert_eq!(
        app.workspace.created_at.as_deref(),
        Some("2026-11-01T00:00:00.000Z")
    );
    assert!(read_listing(&files[1]).expect("CLI").has_responses);
    assert!(!read_listing(&files[2]).expect("unused").has_responses);

    let mut cache = ListingCache::default();
    cache.listing(&files[0]).expect("first read");
    cache.listing(&files[0]).expect("cached");
    assert_eq!(cache.reads, 1);
}

#[test]
fn workspace_values_can_be_quoted() {
    let workspace = parse_workspace(
        "id: abc\nname: 'It''s: quoted'\ncwd: \"/a \\\"b\\\"\"\nsummary: |\n  ignored\nclient_name: null\n",
    );
    assert_eq!(workspace.id.as_deref(), Some("abc"));
    assert_eq!(workspace.name.as_deref(), Some("It's: quoted"));
    assert_eq!(workspace.cwd.as_deref(), Some("/a \"b\""));
    assert_eq!(workspace.client_name, None);
}

#[test]
fn an_app_session_has_one_call_per_assistant_turn() {
    let loaded = load("001");
    let session = &loaded.session;
    assert_eq!(session.id, session_id("001"));
    assert_eq!(session.source.kind, "copilot");
    assert_eq!(session.source.version, "1.0.106");
    assert_eq!(session.title.as_deref(), Some("Synthetic: app session"));
    assert_eq!(
        session.working_directory.as_deref(),
        Some("/synthetic/project")
    );
    // The subagent's call is left out.
    assert_eq!(session.model_calls.len(), 4);
    assert_eq!(loaded.records, 34);

    assert_eq!(
        labels(session, 0),
        ["System prompt", "User · List the files"]
    );
    assert_eq!(
        labels(session, 2),
        [
            "System prompt",
            "User · List the files",
            "Assistant · bash",
            "bash result · ls src",
            "Assistant · I'll load the skill.",
            "skill result · synthetic",
            "view result · missing.rs",
            "Skill · synthetic",
        ]
    );
}

#[test]
fn usage_records_give_each_call_its_usage_cost_target_and_timing() {
    let session = load("001").session;
    let first = &session.model_calls[0];
    let usage = &first.reported_usage;
    assert_eq!(usage.input, Some(200));
    assert_eq!(usage.cache_read, Some(0));
    assert_eq!(usage.cache_write, Some(1000));
    assert_eq!(usage.output, Some(20));
    assert_eq!(usage.cost.total, Some(0.1));
    assert_eq!(first.target.provider.as_deref(), Some("github-copilot"));
    assert_eq!(first.target.model.as_deref(), Some("gpt-6.2-astra"));
    assert_eq!(first.target.api.as_deref(), Some("openai-responses"));
    assert_eq!(first.stop_reason.as_deref(), Some("stop"));
    let start = chrono::DateTime::parse_from_rfc3339("2026-11-01T00:00:10.000Z")
        .expect("time")
        .timestamp_millis();
    assert_eq!(first.timestamps.started_at_ms, Some(start));
    assert_eq!(first.timestamps.recorded_at_ms, Some(start + 2000));
    assert_eq!(first.tool_calls_after.len(), 1);

    let second = &session.model_calls[1];
    let failed: Vec<(&str, bool)> = second
        .tool_calls_after
        .iter()
        .map(|call| (call.name.as_str(), call.failed))
        .collect();
    assert_eq!(failed, [("skill", false), ("view", true)]);

    let last = &session.model_calls[3];
    assert_eq!(last.target.model.as_deref(), Some("claude-sonnet-5.5"));
    assert_eq!(last.target.api.as_deref(), Some("anthropic-messages"));
}

#[test]
fn reported_reasoning_is_kept_before_its_response() {
    let session = load("001").session;
    let thinking = session
        .context_items
        .iter()
        .find(|item| item.kind == ContextItemKind::Thinking)
        .expect("thinking");
    assert_eq!(thinking.label, "Thinking · 40 reported tokens");
    let ids = &session.model_calls[3].context_item_ids;
    let position = ids.iter().position(|id| *id == thinking.id).expect("kept");
    assert!(ids[position + 1].starts_with("copilot:response:"));
}

#[test]
fn a_compaction_keeps_the_last_messages_from_when_it_started() {
    let loaded = load("001");
    let session = &loaded.session;
    assert_eq!(session.compactions.len(), 1);
    let compaction = &session.compactions[0];
    assert_eq!(compaction.before_model_call, 4);
    assert_eq!(compaction.tokens_before, Some(1600));
    assert_eq!(compaction.source_item_ids.len(), 6);
    assert_eq!(
        session.model_calls[3].compaction_before.as_deref(),
        Some(compaction.id.as_str())
    );
    assert_eq!(
        labels(session, 3),
        [
            "System prompt",
            "Compaction summary",
            "Skill · synthetic",
            "Thinking · 40 reported tokens",
            "Assistant · There are two files.",
            "User · Summarise",
        ]
    );
    // The repeated system message is the same item.
    assert_eq!(
        session
            .context_items
            .iter()
            .filter(|item| item.kind == ContextItemKind::System)
            .count(),
        1
    );
    for limitation in [
        Limitation::MissingHistoricalToolDefinitions,
        Limitation::SubagentCallsNotShown,
        Limitation::MissingCompactionUsage,
    ] {
        assert!(loaded.limitations.contains(&limitation), "{limitation:?}");
    }
    assert!(!loaded
        .limitations
        .contains(&Limitation::UnverifiedCompactionRetention));
}

#[test]
fn a_compaction_without_message_counts_keeps_only_its_summary() {
    let line = |kind: &str, data: &str| format!(r#"{{"type":"{kind}","data":{data}}}"#);
    let text = [
        line("system.message", r#"{"content":"System"}"#),
        line("user.message", r#"{"content":"One"}"#),
        line(
            "session.compaction_complete",
            r#"{"success":true,"summaryContent":"S"}"#,
        ),
        line("user.message", r#"{"content":"Two"}"#),
        line("assistant.turn_start", "{}"),
        line(
            "session.usage_record",
            r#"{"usage":{"apiCallId":"a","inputTokens":10,"outputTokens":1}}"#,
        ),
        line("assistant.turn_end", "{}"),
    ]
    .join("\n")
        + "\n";
    let loaded = super::reconstruct::reconstruct(&text, "x").expect("reconstructs");
    assert_eq!(
        labels(&loaded.session, 0),
        ["System prompt", "Compaction summary", "User · Two"]
    );
    assert!(loaded
        .limitations
        .contains(&Limitation::UnverifiedCompactionRetention));
}

#[test]
fn an_unfinished_last_line_is_skipped() {
    let loaded = load("002");
    assert_eq!(loaded.session.model_calls.len(), 1);
    assert_eq!(loaded.session.title, None);
    assert_eq!(loaded.session.source.version, "1.0.91");
    assert_eq!(
        loaded.limitations,
        [Limitation::MissingHistoricalToolDefinitions].into()
    );
}

#[test]
fn an_invalid_line_before_the_last_is_an_error() {
    let text = "{\"type\":\"session.start\",\"data\":{}}\nnot json\n";
    assert!(super::reconstruct::reconstruct(text, "x").is_err());
}

#[test]
fn truncation_and_clearing_remove_messages_without_a_summary() {
    let line = |kind: &str, data: &str| format!(r#"{{"type":"{kind}","data":{data}}}"#);
    let call = |id: &str| {
        [
            line("assistant.turn_start", "{}"),
            line(
                "session.usage_record",
                &format!(r#"{{"usage":{{"apiCallId":"{id}","inputTokens":10,"outputTokens":1}}}}"#),
            ),
            line(
                "assistant.message",
                &format!(r#"{{"apiCallId":"{id}","content":"Reply {id}"}}"#),
            ),
            line("assistant.turn_end", "{}"),
        ]
        .join("\n")
    };
    let text = [
        line("system.message", r#"{"content":"System"}"#),
        line("user.message", r#"{"content":"One"}"#),
        call("a"),
        line(
            "session.truncation",
            r#"{"messagesRemovedDuringTruncation":1}"#,
        ),
        call("b"),
        line("session.context_cleared", r#"{"messagesCleared":2}"#),
        line("user.message", r#"{"content":"Two"}"#),
        call("c"),
    ]
    .join("\n")
        + "\n";
    let session = super::reconstruct::reconstruct(&text, "x")
        .expect("reconstructs")
        .session;
    assert_eq!(labels(&session, 0), ["System prompt", "User · One"]);
    assert_eq!(
        labels(&session, 1),
        ["System prompt", "Assistant · Reply a"]
    );
    assert_eq!(labels(&session, 2), ["System prompt", "User · Two"]);
    assert!(session.compactions.is_empty());
}

fn line(kind: &str, data: &str) -> String {
    format!(r#"{{"type":"{kind}","data":{data}}}"#)
}

/// One model call: a turn with a usage record and a response.
fn call(id: &str, reasoning: u64) -> String {
    [
        line("assistant.turn_start", "{}"),
        line(
            "session.usage_record",
            &format!(
                r#"{{"usage":{{"apiCallId":"{id}","inputTokens":10,"outputTokens":1,"reasoningTokens":{reasoning}}}}}"#
            ),
        ),
        line(
            "assistant.message",
            &format!(r#"{{"apiCallId":"{id}","content":"Reply {id}","reasoningOpaque":"x"}}"#),
        ),
        line("assistant.turn_end", "{}"),
    ]
    .join("\n")
}

fn read(lines: &[String]) -> super::Loaded {
    super::reconstruct::reconstruct(&(lines.join("\n") + "\n"), "x").expect("reconstructs")
}

#[test]
fn truncation_keeps_the_reasoning_of_the_next_response() {
    let loaded = read(&[
        line("system.message", r#"{"content":"System"}"#),
        line("user.message", r#"{"content":"One"}"#),
        call("a", 7),
        line(
            "session.truncation",
            r#"{"messagesRemovedDuringTruncation":1}"#,
        ),
        call("b", 0),
    ]);
    assert_eq!(
        labels(&loaded.session, 1),
        [
            "System prompt",
            "Thinking · 7 reported tokens",
            "Assistant · Reply a"
        ]
    );
}

#[test]
fn a_compaction_counts_from_where_it_started_after_a_truncation() {
    let loaded = read(&[
        line("system.message", r#"{"content":"System"}"#),
        line("user.message", r#"{"content":"One"}"#),
        line("user.message", r#"{"content":"Two"}"#),
        line("user.message", r#"{"content":"Three"}"#),
        line("session.compaction_start", r#"{"compactionAttemptId":"c"}"#),
        line(
            "session.truncation",
            r#"{"messagesRemovedDuringTruncation":1}"#,
        ),
        line("user.message", r#"{"content":"Four"}"#),
        line(
            "session.compaction_complete",
            r#"{"success":true,"compactionAttemptId":"c","preCompactionMessagesLength":3,"messagesRemoved":2,"summaryContent":"S"}"#,
        ),
        call("a", 0),
    ]);
    assert_eq!(
        labels(&loaded.session, 0),
        [
            "System prompt",
            "Compaction summary",
            "User · Three",
            "User · Four"
        ]
    );
}

#[test]
fn a_usage_record_without_a_duration_has_no_start_time() {
    let loaded = read(&[line("user.message", r#"{"content":"One"}"#), call("a", 0)]);
    let timestamps = &loaded.session.model_calls[0].timestamps;
    assert_eq!(timestamps.started_at_ms, None);
}

/// A session folder in a temporary Copilot home, with `events` as its event log.
fn temporary_session(events: &[String]) -> (tempfile::TempDir, super::discovery::SessionFile) {
    let directory = tempfile::tempdir().expect("temporary directory");
    let home = fs::canonicalize(directory.path()).expect("home");
    let folder = home.join("session-state").join("s");
    fs::create_dir_all(&folder).expect("session folder");
    fs::write(folder.join("events.jsonl"), events.join("\n") + "\n").expect("events");
    let file = find_files(&home, None)
        .expect("discovery")
        .pop()
        .expect("session");
    (directory, file)
}

#[test]
fn a_listing_counts_only_the_calls_the_reader_shows() {
    let usage = || line("session.usage_record", r#"{"usage":{"inputTokens":1}}"#);
    let outside_turn = temporary_session(&[usage()]);
    assert!(
        !read_listing(&outside_turn.1)
            .expect("listing")
            .has_responses
    );

    let checkpoint = temporary_session(&[
        line("assistant.turn_start", "{}"),
        r#"{"type":"session.usage_record","checkpoint":true,"data":{"usage":{}}}"#.to_owned(),
    ]);
    assert!(!read_listing(&checkpoint.1).expect("listing").has_responses);

    let null_agent = temporary_session(&[
        line("assistant.turn_start", "{}"),
        r#"{"type":"session.usage_record","agentId":null,"data":{"usage":{}}}"#.to_owned(),
    ]);
    assert!(read_listing(&null_agent.1).expect("listing").has_responses);
}

#[cfg(unix)]
#[test]
fn a_workspace_file_that_is_a_symbolic_link_is_not_read() {
    let (directory, file) = temporary_session(&[line("user.message", r#"{"content":"One"}"#)]);
    let target = directory.path().join("elsewhere.yaml");
    fs::write(&target, "name: Outside\n").expect("target");
    let folder = file.path.parent().expect("folder");
    std::os::unix::fs::symlink(&target, folder.join("workspace.yaml")).expect("link");
    assert_eq!(super::discovery::read_workspace(folder).name, None);
}
