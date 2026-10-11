use super::{
    discovery::{find_files, read_listing, DiscoveryError, ListingCache, TranscriptFile},
    FileKind,
};
use serde_json::Value;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::atomic::AtomicBool,
};

fn fixture_root() -> PathBuf {
    fs::canonicalize("fixtures/claude-code/projects").expect("fixture root")
}

fn expected(name: &str) -> Value {
    let text = fs::read_to_string(format!("fixtures/claude-code/expected/{name}.json"))
        .expect("expected result");
    serde_json::from_str(&text).expect("expected JSON")
}

fn relative(root: &Path, file: &TranscriptFile) -> String {
    file.path
        .strip_prefix(root)
        .expect("inside root")
        .to_string_lossy()
        .into_owned()
}

fn strings(value: &Value) -> Vec<String> {
    value
        .as_array()
        .expect("array")
        .iter()
        .map(|item| item.as_str().expect("string").to_owned())
        .collect()
}

#[test]
fn discovery_finds_main_sessions_and_subagents_and_nothing_else() {
    let root = fixture_root();
    let files = find_files(&root, None).expect("discovery");
    let of_kind = |kind| {
        let mut paths: Vec<String> = files
            .iter()
            .filter(|file| file.kind == kind)
            .map(|file| relative(&root, file))
            .collect();
        paths.sort();
        paths
    };
    let discovery = expected("discovery");
    let mut sessions = strings(&discovery["sessions"]);
    sessions.sort();
    assert_eq!(of_kind(FileKind::Main), sessions);
    assert_eq!(
        of_kind(FileKind::Subagent),
        strings(&discovery["subagents"])
    );
    for ignored in strings(&discovery["ignored"]) {
        assert!(files.iter().all(|file| relative(&root, file) != ignored));
    }
}

#[test]
fn listings_read_session_identity_titles_and_working_directory() {
    let root = fixture_root();
    let files = find_files(&root, None).expect("discovery");
    let entries = fs::read_dir("fixtures/claude-code/expected").expect("expected directory");
    let mut checked = 0;
    for entry in entries {
        let path = entry.expect("entry").path();
        if path.file_stem().and_then(|stem| stem.to_str()) == Some("discovery") {
            continue;
        }
        let expected: Value =
            serde_json::from_str(&fs::read_to_string(&path).expect("read")).expect("JSON");
        let fixture = expected["fixture"].as_str().expect("fixture");
        let file = files
            .iter()
            .find(|file| relative(&root, file) == fixture)
            .unwrap_or_else(|| panic!("{fixture} was not discovered"));
        let listing = read_listing(file).expect("listing");
        assert_eq!(
            listing.session_id.as_deref(),
            expected["sessionId"].as_str(),
            "{fixture}"
        );
        assert_eq!(
            listing.working_directory.as_deref(),
            expected["listing"]["workingDirectory"].as_str(),
            "{fixture}"
        );
        assert!(listing.started_at.is_some(), "{fixture}");
        let subagent = &expected["listing"]["subagent"];
        if subagent.is_object() {
            let metadata = listing.subagent.as_ref().expect("subagent metadata");
            assert_eq!(listing.agent_id.as_deref(), subagent["agentId"].as_str());
            assert_eq!(
                metadata.agent_type.as_deref(),
                subagent["agentType"].as_str()
            );
            assert_eq!(
                metadata.parent_tool_use_id.as_deref(),
                subagent["parentToolUseId"].as_str()
            );
        } else {
            assert!(listing.subagent.is_none(), "{fixture}");
        }
        checked += 1;
    }
    assert_eq!(checked, 18);
}

#[test]
fn a_custom_title_wins_over_a_later_generated_title() {
    let root = fixture_root();
    let files = find_files(&root, None).expect("discovery");
    let simple = files
        .iter()
        .find(|file| file.path.ends_with("simple.jsonl"))
        .expect("simple fixture");
    assert_eq!(
        read_listing(simple).expect("listing").title.as_deref(),
        Some("Synthetic greeting")
    );
}

#[cfg(unix)]
#[test]
fn symbolic_links_are_not_followed() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let root = fs::canonicalize(directory.path()).expect("root");
    let project = root.join("-project");
    fs::create_dir(&project).expect("project");
    let simple = fs::canonicalize("fixtures/claude-code/projects/-synthetic-project/simple.jsonl")
        .expect("fixture");
    std::os::unix::fs::symlink(&simple, project.join("linked.jsonl")).expect("file link");
    std::os::unix::fs::symlink(
        fs::canonicalize("fixtures/claude-code/projects/-synthetic-project").expect("fixture"),
        root.join("-linked-project"),
    )
    .expect("directory link");
    fs::copy(&simple, project.join("real.jsonl")).expect("copy");
    let files = find_files(&root, None).expect("discovery");
    assert_eq!(files.len(), 1);
    assert!(files[0].path.ends_with("-project/real.jsonl"));
}

#[test]
fn discovery_can_be_cancelled_and_a_missing_root_reads_as_empty() {
    let cancelled = AtomicBool::new(true);
    assert!(matches!(
        find_files(&fixture_root(), Some(&cancelled)),
        Err(DiscoveryError::Cancelled)
    ));
    let directory = tempfile::tempdir().expect("temporary directory");
    assert!(find_files(&directory.path().join("missing"), None)
        .expect("missing root")
        .is_empty());
}

#[test]
fn listing_cache_reads_a_transcript_again_only_after_it_changes() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let root = fs::canonicalize(directory.path()).expect("root");
    let project = root.join("-project");
    fs::create_dir(&project).expect("project");
    let path = project.join("session.jsonl");
    fs::copy(
        "fixtures/claude-code/projects/-synthetic-project/split-response.jsonl",
        &path,
    )
    .expect("copy");
    let mut cache = ListingCache::default();
    let find = || find_files(&root, None).expect("discovery");
    let first = cache
        .listing(&find()[0])
        .expect("listing")
        .expect("present");
    let second = cache
        .listing(&find()[0])
        .expect("listing")
        .expect("present");
    assert_eq!(first, second);
    assert_eq!(cache.reads, 1);
    assert!(first.title.is_none());

    let mut file = fs::OpenOptions::new()
        .append(true)
        .open(&path)
        .expect("open");
    writeln!(
        file,
        r#"{{"type":"ai-title","aiTitle":"Reading notes","sessionId":"00000002-0000-4000-8000-000000000000"}}"#
    )
    .expect("append");
    drop(file);
    let files = find();
    let third = cache.listing(&files[0]).expect("listing").expect("present");
    assert_eq!(cache.reads, 2);
    assert_eq!(third.title.as_deref(), Some("Reading notes"));

    fs::remove_file(&path).expect("remove");
    cache.retain(&find());
    assert_eq!(cache.listing(&files[0]).expect("removed"), None);
}

#[test]
fn a_subagent_without_metadata_or_records_falls_back_to_its_file_name() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let root = fs::canonicalize(directory.path()).expect("root");
    let subagents = root.join("-project/session/subagents");
    fs::create_dir_all(&subagents).expect("subagents");
    fs::write(subagents.join("agent-b7.jsonl"), "").expect("empty transcript");
    let files = find_files(&root, None).expect("discovery");
    assert_eq!(files.len(), 1);
    assert_eq!(files[0].kind, FileKind::Subagent);
    let listing = read_listing(&files[0]).expect("listing");
    assert_eq!(listing.agent_id.as_deref(), Some("b7"));
    assert_eq!(listing.session_id, None);
    assert_eq!(listing.subagent, Some(Default::default()));
}

fn item_key(id: &str) -> String {
    id.strip_prefix("claude-code:")
        .unwrap_or_else(|| panic!("unexpected item id {id}"))
        .to_owned()
}

fn expected_fixtures() -> Vec<(String, Value)> {
    let mut results = Vec::new();
    for entry in fs::read_dir("fixtures/claude-code/expected").expect("expected directory") {
        let path = entry.expect("entry").path();
        let name = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .expect("name")
            .to_owned();
        if name != "discovery" {
            let value = serde_json::from_str(&fs::read_to_string(&path).expect("read"))
                .expect("expected JSON");
            results.push((name, value));
        }
    }
    results.sort_by(|left, right| left.0.cmp(&right.0));
    results
}

fn fixture_kind(expected: &Value) -> FileKind {
    if expected["listing"]["kind"] == "subagent" {
        FileKind::Subagent
    } else {
        FileKind::Main
    }
}

#[test]
fn active_branches_match_the_expected_results() {
    assert_eq!(expected_fixtures().len(), 18);
    for (name, expected) in expected_fixtures() {
        let path = fixture_root().join(expected["fixture"].as_str().expect("fixture"));
        let records = super::records::parse(std::io::BufReader::new(
            fs::File::open(path).expect("fixture"),
        ))
        .expect("records");
        let branch: Vec<&str> = super::branch::select(&records)
            .expect("branch")
            .indexes
            .into_iter()
            .map(|index| records[index].uuid().expect("uuid"))
            .collect();
        assert_eq!(branch, strings(&expected["branch"]), "{name}");
    }
}

#[test]
fn calls_context_and_compactions_match_the_expected_results() {
    assert_eq!(expected_fixtures().len(), 18);
    for (name, expected) in expected_fixtures() {
        let path = fixture_root().join(expected["fixture"].as_str().expect("fixture"));
        let loaded = super::load(&path, fixture_kind(&expected)).expect("load");
        let session = &loaded.session;
        assert_eq!(session.source.kind, "claude-code", "{name}");
        assert_eq!(
            session.working_directory.as_deref(),
            expected["listing"]["workingDirectory"].as_str(),
            "{name}"
        );

        let calls = expected["calls"].as_array().expect("calls");
        assert_eq!(session.model_calls.len(), calls.len(), "{name}: call count");
        for (call, expected) in session.model_calls.iter().zip(calls) {
            let message = expected["message"].as_str().expect("message");
            let label = format!("{name} {message}");
            assert_eq!(call.source_record_id, message, "{label}");
            assert_eq!(
                call.target.model.as_deref(),
                expected["model"].as_str(),
                "{label}"
            );
            assert_eq!(
                call.target.provider.as_deref(),
                Some("anthropic"),
                "{label}"
            );
            assert_eq!(
                call.target.api.as_deref(),
                Some("anthropic-messages"),
                "{label}"
            );
            let usage = &call.reported_usage;
            assert_eq!(
                usage.placeholder.is_some(),
                expected["failed"] == true,
                "{label}"
            );
            if expected["usage"].is_null() {
                assert!(usage.input.is_none() && usage.output.is_none(), "{label}");
            } else {
                let field = |key: &str| expected["usage"][key].as_u64();
                assert_eq!(usage.input, field("input"), "{label} input");
                assert_eq!(usage.cache_read, field("cacheRead"), "{label} cache read");
                assert_eq!(
                    usage.cache_write,
                    field("cacheWrite"),
                    "{label} cache write"
                );
                assert_eq!(
                    usage.cache_write_1h,
                    field("cacheWrite1h"),
                    "{label} 1h write"
                );
                assert_eq!(usage.output, field("output"), "{label} output");
                assert_eq!(usage.recorded_output, field("output"), "{label} recorded");
                assert_eq!(usage.reasoning, field("reasoning"), "{label} reasoning");
            }
            let context: Vec<String> = call
                .context_item_ids
                .iter()
                .map(|id| item_key(id))
                .collect();
            assert_eq!(context, strings(&expected["context"]), "{label} context");
            let tools: Vec<(String, String, bool)> = call
                .tool_calls_after
                .iter()
                .map(|tool| (tool.id.clone(), tool.name.clone(), tool.failed))
                .collect();
            let expected_tools: Vec<(String, String, bool)> = expected["toolCallsAfter"]
                .as_array()
                .expect("tools")
                .iter()
                .map(|tool| {
                    (
                        tool["id"].as_str().expect("id").to_owned(),
                        tool["name"].as_str().expect("name").to_owned(),
                        tool["failed"].as_bool().expect("failed"),
                    )
                })
                .collect();
            assert_eq!(tools, expected_tools, "{label} tools");
        }

        let compactions = expected["compactions"].as_array().expect("compactions");
        assert_eq!(session.compactions.len(), compactions.len(), "{name}");
        for (compaction, expected) in session.compactions.iter().zip(compactions) {
            let before = &session.model_calls[compaction.before_model_call - 1];
            assert_eq!(
                before.source_record_id,
                expected["beforeCall"].as_str().expect("call")
            );
            assert_eq!(
                before.compaction_before.as_ref(),
                Some(&compaction.id),
                "{name}"
            );
            assert_eq!(
                compaction.tokens_before,
                expected["tokensBefore"].as_u64(),
                "{name}"
            );
            assert_eq!(
                item_key(&compaction.summary_item_id),
                expected["summary"],
                "{name}"
            );
            let keys = |ids: &[String]| ids.iter().map(|id| item_key(id)).collect::<Vec<_>>();
            assert_eq!(
                keys(&compaction.retained_item_ids),
                strings(&expected["retained"]),
                "{name}"
            );
            assert_eq!(
                keys(&compaction.source_item_ids),
                strings(&expected["sources"]),
                "{name}"
            );
        }

        let own = &expected["ownCostTotal"];
        match session.harness_session_cost {
            None => assert!(own.is_null(), "{name} own cost total"),
            Some(cost) => {
                assert_eq!(Some(cost.total_usd), own["totalUsd"].as_f64(), "{name}");
                assert_eq!(cost.since_ms, own["startTimeMs"].as_i64(), "{name}");
            }
        }

        let mut limitations: Vec<&str> = loaded
            .limitations
            .iter()
            .map(|limitation| limitation.as_str())
            .collect();
        limitations.sort();
        let mut expected_limitations = strings(&expected["limitations"]);
        expected_limitations.sort();
        assert_eq!(limitations, expected_limitations, "{name} limitations");

        crate::analysis::analyze(
            loaded.session,
            crate::analysis::AnalysisConfig {
                tokenization: crate::analysis::TokenizationPolicy::Heuristic,
                perf_diagnostics: false,
            },
        )
        .unwrap_or_else(|error| panic!("{name}: {error}"));
    }
}

fn load_text(text: &str) -> Result<super::Loaded, crate::domain::SourceError> {
    let directory = tempfile::tempdir().expect("temporary directory");
    let path = directory.path().join("session.jsonl");
    fs::write(&path, text).expect("write");
    super::load(&path, FileKind::Main)
}

const HEADER: &str = r#""sessionId":"s","cwd":"/synthetic","timestamp":"2026-10-01T00:00:00.000Z""#;

fn user(uuid: &str, parent: Option<&str>) -> String {
    let parent = parent.map_or("null".to_owned(), |parent| format!("\"{parent}\""));
    format!(
        r#"{{"type":"user","uuid":"{uuid}","parentUuid":{parent},{HEADER},"message":{{"role":"user","content":"hi"}}}}"#
    )
}

#[test]
fn tool_references_become_their_own_content_part() {
    use crate::domain::{ContentPart, TokenizationPayload};
    let loaded = super::load(
        &fixture_root().join("-synthetic-project/content-kinds.jsonl"),
        FileKind::Main,
    )
    .expect("content kinds");
    let references: Vec<&str> = loaded
        .session
        .context_items
        .iter()
        .filter_map(|item| match &item.payload {
            TokenizationPayload::ToolResult { content, .. } => Some(&content.parts),
            _ => None,
        })
        .flatten()
        .filter_map(|part| match part {
            ContentPart::ToolReference(name) => Some(name.as_str()),
            _ => None,
        })
        .collect();
    assert_eq!(references.len(), 1);
}

/// Claude Code 2.1.287 can write a boundary whose `logicalParentUuid` and preserved
/// segment tail name a record written after it. The compaction fixture rewritten that way
/// must give the same branch and retained items as the original.
#[test]
fn a_boundary_naming_a_later_record_continues_from_the_record_before_it() {
    let original = fs::read_to_string(fixture_root().join("-synthetic-project/compaction.jsonl"))
        .expect("fixture");
    let rewritten = original
        .replace(
            r#""logicalParentUuid":"s6-s1""#,
            r#""logicalParentUuid":"s6-f1""#,
        )
        .replace(r#""tailUuid":"s6-s1""#, r#""tailUuid":"s6-f1""#)
        .replace(
            r#""uuids":["s6-u2","s6-a3","s6-t2","s6-s1"]"#,
            r#""uuids":["s6-u2","s6-a3","s6-t2","s6-s1","s6-f1"]"#,
        );
    assert_eq!(
        rewritten.matches("s6-f1").count(),
        original.matches("s6-f1").count() + 3
    );
    let before = load_text(&original).expect("original");
    let after = load_text(&rewritten).expect("rewritten");
    assert_eq!(after.selected_records, before.selected_records);
    assert!(after
        .limitations
        .contains(&super::Limitation::RepairedCompactionLink));
    assert!(!before
        .limitations
        .contains(&super::Limitation::RepairedCompactionLink));
    assert!(!after
        .limitations
        .contains(&super::Limitation::UnverifiedCompactionRetention));
    let summary = |loaded: &super::Loaded| {
        let compaction = &loaded.session.compactions[0];
        (
            compaction.retained_item_ids.clone(),
            compaction.source_item_ids.clone(),
            loaded.session.model_calls.len(),
        )
    };
    assert_eq!(summary(&after), summary(&before));
    // A loop that does not go through a boundary is still rejected.
    let looped = format!("{}\n{}\n", user("a", Some("b")), user("b", Some("a")));
    assert!(load_text(&looped).is_err());
}

#[test]
fn invalid_graphs_are_rejected() {
    use crate::domain::SourceError::InvalidStructure;
    let cases = [
        format!("{}\n{}\n", user("a", None), user("a", None)),
        format!("{}\n", user("a", Some("missing"))),
        format!("{}\n{}\n", user("a", Some("b")), user("b", Some("a"))),
        format!("{}\n", user("a", Some("a"))),
        "{\"type\":\"mode\",\"mode\":\"normal\",\"sessionId\":\"s\"}\n".to_owned(),
    ];
    for case in cases {
        assert!(
            matches!(load_text(&case), Err(InvalidStructure(_))),
            "{case}"
        );
    }
}

#[test]
fn malformed_lines_and_unsafe_counters_are_rejected() {
    use crate::domain::SourceError;
    let error = load_text(&format!(
        "{}\nnot json\n{}\n",
        user("a", None),
        user("b", Some("a"))
    ))
    .expect_err("invalid JSON");
    assert!(matches!(error, SourceError::Json { line: 2, .. }));
    let unsafe_usage = format!(
        "{}\n{{\"type\":\"assistant\",\"uuid\":\"b\",\"parentUuid\":\"a\",{HEADER},\"message\":{{\"id\":\"m\",\"model\":\"claude-opus-5-5\",\"content\":[],\"usage\":{{\"input_tokens\":9007199254740992}}}}}}\n",
        user("a", None)
    );
    assert!(matches!(
        load_text(&unsafe_usage),
        Err(SourceError::UnsafeInteger { .. })
    ));
}

#[test]
fn labels_name_tools_commands_and_attachments() {
    let label = |fixture: &str, item: &str| {
        let loaded = super::load(&fixture_root().join(fixture), FileKind::Main).expect("load");
        loaded
            .session
            .context_items
            .iter()
            .find(|candidate| item_key(&candidate.id) == item)
            .unwrap_or_else(|| panic!("{item} not found"))
            .label
            .clone()
    };
    let split = "-synthetic-project/split-response.jsonl";
    assert_eq!(label(split, "user:s2-u1"), "User · Read the notes file.");
    assert_eq!(
        label(split, "assistant:msg_s2_1"),
        "Assistant · Reading it now."
    );
    assert_eq!(label(split, "tool:toolu_s2_1"), "Read result · notes.txt");
    assert_eq!(label(split, "tool:toolu_s2_2"), "Bash result · ls");
    let parallel = "-synthetic-project/parallel-tools.jsonl";
    assert_eq!(
        label(parallel, "assistant:msg_s3_1"),
        "Assistant · Read, Read"
    );
    assert_eq!(label(parallel, "tool:toolu_s3_c"), "Grep result · alpha");
    let attachments = "-synthetic-project/attachments.jsonl";
    assert_eq!(label(attachments, "attachment:s8-e1"), "Environment");
    assert_eq!(
        label(attachments, "attachment:s8-q1"),
        "Queued notification"
    );
    assert_eq!(label(attachments, "meta:s8-v1"), "Command caveat");
    assert_eq!(label(attachments, "user:s8-c1"), "Command · /model");
    assert_eq!(label(attachments, "user:s8-o1"), "Command output");
    let content = "-synthetic-project/content-kinds.jsonl";
    assert_eq!(
        label(content, "user:s11-u1"),
        "User · What is in this picture?"
    );
    let compaction = "-synthetic-project/compaction.jsonl";
    assert_eq!(label(compaction, "summary:s6-c1"), "Compaction summary");
    assert_eq!(label(compaction, "attachment:s6-f1"), "File · one.txt");
}

#[test]
fn claude_code_calls_are_priced_at_the_api_rate() {
    use crate::analysis::{analyze, AnalysisConfig, TokenizationPolicy};
    let loaded = super::load(
        &fixture_root().join("-synthetic-project/compaction.jsonl"),
        FileKind::Main,
    )
    .expect("load");
    let subscription = analyze(
        loaded.session,
        AnalysisConfig {
            tokenization: TokenizationPolicy::Heuristic,
            perf_diagnostics: false,
        },
    )
    .expect("analysis");
    for call in &subscription.model_calls {
        let cost = &call.cost_assessment;
        assert_eq!(cost.kind, "apiEquivalent");
        assert_eq!(cost.billing_mode, Some("subscription"));
        assert_eq!(cost.classification_rule, "billingModeTable");
        assert!(cost.amount.is_some_and(|amount| amount > 0.0));
        assert_eq!(cost.recorded_by_harness, None);
    }
    // msg_s6_1 wrote 400 tokens with a one-hour lifetime, which cost twice the
    // input rate rather than the five-minute write rate (claude-opus-5-5: $4 input,
    // $20 output, $5 cache write per million).
    let first = subscription.model_calls[0]
        .cost_assessment
        .amount
        .expect("amount");
    let expected = (5.0 * 4.0 + 400.0 * 8.0 + 25.0 * 20.0) / 1_000_000.0;
    assert!((first - expected).abs() < 1e-12, "{first} != {expected}");
}

#[test]
fn thinking_is_sized_by_reported_reasoning_for_the_model_that_produced_it() {
    use crate::domain::{ContextItemKind, TokenizationPayload};
    let loaded = super::load(
        &fixture_root().join("-synthetic-project/split-response.jsonl"),
        FileKind::Main,
    )
    .expect("load");
    let thinking = loaded
        .session
        .context_items
        .iter()
        .find(|item| item.kind == ContextItemKind::Thinking)
        .expect("thinking item");
    assert_eq!(thinking.label, "Thinking · 7 reported tokens");
    assert!(matches!(
        thinking.payload,
        TokenizationPayload::ReportedThinking { tokens: 7, .. }
    ));
    let response = loaded
        .session
        .context_items
        .iter()
        .find(|item| item.id == "claude-code:assistant:msg_s2_1")
        .expect("response");
    assert!(matches!(
        response.payload,
        TokenizationPayload::AssistantMessage {
            thinking_reported: true,
            ..
        }
    ));
    let analysis = crate::analysis::analyze(
        loaded.session,
        crate::analysis::AnalysisConfig {
            tokenization: crate::analysis::TokenizationPolicy::Auto,
            perf_diagnostics: false,
        },
    )
    .expect("analysis");
    let item = analysis
        .context_items
        .iter()
        .find(|item| item.kind == "thinking")
        .expect("thinking in the analysis");
    assert_eq!(item.token_estimates.len(), 1);
    assert_eq!(item.token_estimates[0].tokens, Some(7));
    assert_eq!(item.token_estimates[0].method, "reportedUsage");
}
