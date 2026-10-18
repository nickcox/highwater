use super::discovery::{find_files, read_listing, ChildThread, ListingCache, TitleIndex};
use crate::claude_code::Limitation;
use std::{fs, io::Read, path::PathBuf};

fn home() -> PathBuf {
    fs::canonicalize("fixtures/codex/home").expect("fixture home")
}

fn thread(number: &str) -> String {
    format!("01a10000-0000-7000-8000-000000000{number}")
}

fn file_for(number: &str) -> super::discovery::SessionFile {
    find_files(&home(), None)
        .expect("discovery")
        .into_iter()
        .find(|file| {
            file.path
                .to_string_lossy()
                .contains(&format!("-000000000{number}.jsonl"))
        })
        .unwrap_or_else(|| panic!("session {number} was not found"))
}

#[test]
fn discovery_finds_dated_and_archived_sessions_and_nothing_else() {
    let names: Vec<String> = find_files(&home(), None)
        .expect("discovery")
        .iter()
        .map(|file| {
            file.path
                .strip_prefix(home())
                .expect("inside home")
                .to_string_lossy()
                .into_owned()
        })
        .collect();
    assert_eq!(
        names,
        [
            "archived_sessions/rollout-2026-09-01T00-00-00-01a10000-0000-7000-8000-000000000006.jsonl.zst",
            "sessions/2026/10/01/rollout-2026-10-01T10-00-00-01a10000-0000-7000-8000-000000000001.jsonl",
            "sessions/2026/10/01/rollout-2026-10-01T10-05-00-01a10000-0000-7000-8000-000000000003.jsonl",
            "sessions/2026/10/01/rollout-2026-10-01T10-06-00-01a10000-0000-7000-8000-000000000004.jsonl",
            "sessions/2026/10/01/rollout-2026-10-01T11-00-00-01a10000-0000-7000-8000-000000000002.jsonl.zst",
            "sessions/2026/10/01/rollout-2026-10-01T12-00-00-01a10000-0000-7000-8000-000000000005.jsonl",
            "sessions/2026/10/01/rollout-2026-10-01T14-00-00-01a10000-0000-7000-8000-000000000007.jsonl",
            "sessions/2026/10/01/rollout-2026-10-01T15-00-00-01a30000-0000-7000-8000-000000000008.jsonl",
        ]
    );
}

#[test]
fn listings_read_session_meta_from_plain_and_compressed_files() {
    let main = read_listing(&file_for("001")).expect("main");
    assert_eq!(main.thread_id.as_deref(), Some(thread("001").as_str()));
    assert_eq!(main.started_at.as_deref(), Some("2026-10-01T00:00:00.000Z"));
    assert_eq!(
        main.working_directory.as_deref(),
        Some("/synthetic/project")
    );
    assert!(main.has_responses);
    assert_eq!(main.child, None);

    let compressed = read_listing(&file_for("002")).expect("compressed");
    assert_eq!(
        compressed.thread_id.as_deref(),
        Some(thread("002").as_str())
    );
    assert!(compressed.has_responses);

    let archived = read_listing(&file_for("006")).expect("several frames");
    assert_eq!(archived.thread_id.as_deref(), Some(thread("006").as_str()));
    assert!(archived.has_responses);

    assert!(
        !read_listing(&file_for("005"))
            .expect("unused")
            .has_responses
    );
}

#[test]
fn guardian_reviews_and_spawned_subagents_name_their_parent() {
    assert_eq!(
        read_listing(&file_for("003")).expect("guardian").child,
        Some(ChildThread {
            parent_thread_id: thread("001"),
            kind: Some("guardian".into()),
            nickname: None,
        })
    );
    assert_eq!(
        read_listing(&file_for("004")).expect("spawned").child,
        Some(ChildThread {
            parent_thread_id: thread("001"),
            kind: Some("code_review".into()),
            nickname: Some("Hopper".into()),
        })
    );
}

#[test]
fn every_zstd_frame_is_decoded_and_skippable_frames_are_passed_over() {
    let mut text = String::new();
    super::open_text(&file_for("006").path)
        .expect("open")
        .read_to_string(&mut text)
        .expect("decode");
    let lines: Vec<&str> = text.split_terminator('\n').collect();
    assert_eq!(lines.len(), 7);
    for line in lines {
        serde_json::from_str::<serde_json::Value>(line).expect("each line is a record");
    }
}

#[test]
fn a_record_is_not_split_at_a_unicode_line_separator() {
    let mut text = String::new();
    super::open_text(&file_for("001").path)
        .expect("open")
        .read_to_string(&mut text)
        .expect("read");
    assert!(text.contains('\u{2028}'));
    for line in text.split_terminator('\n') {
        serde_json::from_str::<serde_json::Value>(line).expect("each line is a record");
    }
}

#[test]
fn the_latest_title_for_a_thread_wins_and_unchanged_files_are_not_read_again() {
    let mut titles = TitleIndex::default();
    titles.refresh(&home());
    assert_eq!(titles.title(&thread("001")), Some("Synthetic Codex task"));
    assert_eq!(titles.title(&thread("006")), Some("Archived work"));
    assert_eq!(titles.title(&thread("002")), None);

    let files = find_files(&home(), None).expect("discovery");
    let mut cache = ListingCache::default();
    for file in &files {
        cache.listing(file).expect("listing");
    }
    for file in &files {
        cache.listing(file).expect("listing");
    }
    assert_eq!(cache.reads, files.len());
}

#[test]
fn a_missing_home_reads_as_empty() {
    let directory = tempfile::tempdir().expect("temporary directory");
    assert!(find_files(directory.path(), None)
        .expect("missing folders")
        .is_empty());
    let mut titles = TitleIndex::default();
    titles.refresh(directory.path());
    assert_eq!(titles.title(&thread("001")), None);
}

fn loaded(number: &str) -> super::Loaded {
    super::load(&file_for(number).path).expect("loads")
}

fn context(session: &crate::domain::NormalizedSession, call: usize) -> Vec<(String, String)> {
    let labels: std::collections::HashMap<&str, (&crate::domain::ContextItemKind, &str)> = session
        .context_items
        .iter()
        .map(|item| (item.id.as_str(), (&item.kind, item.label.as_str())))
        .collect();
    session.model_calls[call - 1]
        .context_item_ids
        .iter()
        .map(|id| {
            let (kind, label) = labels[id.as_str()];
            (kind.as_str().to_owned(), label.to_owned())
        })
        .collect()
}

fn pair(kind: &str, label: &str) -> (String, String) {
    (kind.to_owned(), label.to_owned())
}

#[test]
fn calls_start_at_a_response_and_take_their_usage_from_the_next_token_count() {
    let loaded = loaded("007");
    let session = &loaded.session;
    assert_eq!(session.source.kind, "codex");
    assert_eq!(session.id, thread("007"));
    assert_eq!(
        session.model_calls.len(),
        5,
        "the zero usage after the compaction is not a call"
    );
    assert_eq!(
        context(session, 1),
        [
            pair("system", "System prompt"),
            pair("toolDefinition", "codex_app.automation_update definition"),
            pair("customMessage", "Permissions instructions"),
            pair("customMessage", "Environment context"),
            pair("userMessage", "User · Fix the failing test"),
        ]
    );
    let usage = &session.model_calls[1].reported_usage;
    assert_eq!(
        (
            usage.input,
            usage.cache_read,
            usage.cache_write,
            usage.output,
            usage.reasoning
        ),
        (Some(800), Some(4800), Some(0), Some(200), Some(50)),
        "cached input is taken out of input_tokens"
    );
    let call = &session.model_calls[0];
    assert_eq!(call.target.model.as_deref(), Some("gpt-5.5"));
    assert_eq!(call.target.api.as_deref(), Some("openai-responses"));
    assert_eq!(call.tool_calls_after[0].name, "exec_command");
    assert!(!call.tool_loadout_known);
}

#[test]
fn reasoning_stays_for_the_rest_of_its_turn() {
    let session = loaded("007").session;
    let second = context(&session, 2);
    assert!(second.contains(&pair("thinking", "Thinking · 120 reported tokens")));
    assert!(second.contains(&pair("toolResult", "exec_command result · cargo test")));
    let third = context(&session, 3);
    assert!(third.contains(&pair("thinking", "Thinking · 120 reported tokens")));
    assert!(third.contains(&pair("thinking", "Thinking · 50 reported tokens")));
    assert!(third.contains(&pair("toolResult", "apply_patch result · src/lib.rs")));
    let fourth = context(&session, 4);
    assert!(fourth.iter().all(|(kind, _)| kind != "thinking"));
}

#[test]
fn a_compaction_keeps_repeated_items_and_adds_an_encrypted_summary() {
    let loaded = loaded("007");
    let session = &loaded.session;
    assert_eq!(session.compactions.len(), 1);
    let compaction = &session.compactions[0];
    assert_eq!(compaction.before_model_call, 5);
    assert_eq!(
        session.model_calls[4].compaction_before.as_deref(),
        Some(compaction.id.as_str())
    );
    let label = |id: &str| {
        session
            .context_items
            .iter()
            .find(|item| item.id == id)
            .map(|item| item.label.clone())
            .unwrap_or_default()
    };
    let retained: Vec<String> = compaction
        .retained_item_ids
        .iter()
        .map(|id| label(id))
        .collect();
    assert_eq!(retained, ["User · Now tidy up"]);
    assert_eq!(
        label(&compaction.summary_item_id),
        "Compaction summary · encrypted"
    );
    assert!(compaction
        .source_item_ids
        .iter()
        .any(|id| label(id) == "User · Fix the failing test"));
    assert_eq!(
        context(session, 5)[2..],
        [
            pair("userMessage", "User · Fix the failing test"),
            pair("userMessage", "User · Now tidy up"),
            pair("customMessage", "AGENTS.md instructions"),
            pair("compactionSummary", "Compaction summary · encrypted"),
            pair("userMessage", "User · Anything else?"),
        ]
    );
    assert!(loaded
        .limitations
        .contains(&Limitation::MissingCompactionUsage));
    assert!(!loaded
        .limitations
        .contains(&Limitation::UnverifiedCompactionRetention));
}

#[test]
fn a_fork_starts_with_the_parent_history_but_not_its_calls() {
    let loaded = loaded("008");
    let session = &loaded.session;
    assert_eq!(
        session.model_calls.len(),
        2,
        "the copied parent call is not the fork's"
    );
    let first = context(session, 1);
    assert_eq!(
        first[1..],
        [
            pair("userMessage", "User · Fix the failing test"),
            pair("assistantMessage", "Assistant · I'll run the tests first."),
            pair("userMessage", "User · Try another approach"),
        ]
    );
    assert!(first.iter().all(|(kind, _)| kind != "thinking"));
    let inherited = session
        .context_items
        .iter()
        .filter(|item| item.metadata.get("inherited").map(String::as_str) == Some("true"))
        .count();
    assert_eq!(inherited, 2);
}

#[test]
fn an_empty_compaction_and_the_history_after_it_are_one_compaction() {
    let loaded = loaded("008");
    let session = &loaded.session;
    assert_eq!(session.compactions.len(), 1);
    assert_eq!(
        session.model_calls[1].compaction_before.as_deref(),
        Some(session.compactions[0].id.as_str())
    );
    assert_eq!(
        context(session, 2)[1..],
        [
            pair("compactionSummary", "Compaction summary · encrypted"),
            pair("userMessage", "User · Try another approach"),
        ]
    );
    assert!(loaded
        .limitations
        .contains(&Limitation::UnverifiedCompactionRetention));
}

/// Loads and analyses every local Codex session and prints counts and accuracy only, never
/// content. Run with `cargo test --release local_codex_sessions -- --ignored --nocapture`.
#[test]
#[ignore = "reads local sessions"]
fn local_codex_sessions_load_and_analyse() {
    use crate::analysis::{analyze, AnalysisConfig, TokenizationPolicy};
    let home = std::env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(std::env::var_os("HOME").expect("HOME")).join(".codex"));
    let files = find_files(&fs::canonicalize(home).expect("Codex home"), None).expect("discovery");
    let (mut loaded, mut analysed, mut gaps) = (0, 0, Vec::new());
    for file in &files {
        let session = match super::load(&file.path) {
            Ok(session) => session,
            Err(error) => {
                println!("load failed: {error}");
                continue;
            }
        };
        loaded += 1;
        let config = AnalysisConfig {
            tokenization: TokenizationPolicy::Auto,
            perf_diagnostics: false,
        };
        match analyze(session.session, config) {
            Ok(analysis) => {
                analysed += 1;
                for call in &analysis.model_calls {
                    let analysis = &call.token_analysis;
                    if let (Some(reported), Some(calculated)) = (
                        analysis.reported_prompt_tokens,
                        analysis.calculated_visible_tokens,
                    ) {
                        if reported > 0 {
                            gaps.push((calculated as f64 - reported as f64) / reported as f64);
                        }
                    }
                }
            }
            Err(error) => println!(
                "analysis failed for {}: {error:?}",
                file.path.file_name().unwrap_or_default().to_string_lossy()
            ),
        }
    }
    gaps.sort_by(f64::total_cmp);
    let absolute = {
        let mut absolute: Vec<f64> = gaps.iter().map(|gap| gap.abs()).collect();
        absolute.sort_by(f64::total_cmp);
        absolute
    };
    let at = |values: &[f64], share: f64| values[((values.len() - 1) as f64 * share) as usize];
    println!(
        "files {}, loaded {loaded}, analysed {analysed}, calls compared {}",
        files.len(),
        gaps.len()
    );
    println!(
        "calculated vs reported input: median gap {:.2}%, median absolute {:.2}%, 90th percentile absolute {:.2}%",
        at(&gaps, 0.5) * 100.0,
        at(&absolute, 0.5) * 100.0,
        at(&absolute, 0.9) * 100.0
    );
}
