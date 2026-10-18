use super::{
    analyse,
    build::{command_family, command_key, item_costs, session_report, user_turns, Paths},
    findings::keep_top,
    repository::repository_of,
    select,
    skill::install,
    types::{Finding, FindingCost, Thresholds, ToolRun},
    ReportArgs,
};
use crate::{
    analysis::{AnalysisConfig, TokenizationPolicy},
    pricing::{self, CallToPrice},
    server::{discover_sessions, SessionFile, SourceArgs, TokenizationArg},
};
use serde_json::json;
use std::{collections::BTreeMap, fs, path::PathBuf};

const CONFIG: AnalysisConfig = AnalysisConfig {
    tokenization: TokenizationPolicy::Heuristic,
    perf_diagnostics: false,
};

/// The Claude Code and Codex fixtures. An explicit, empty Pi root turns off the defaults.
fn fixture_sessions() -> Vec<SessionFile> {
    let empty = tempfile::tempdir().expect("temporary folder");
    discover_sessions(SourceArgs {
        session_root: Some(empty.path().to_path_buf()),
        opencode_db: Vec::new(),
        claude_root: vec![PathBuf::from("fixtures/claude-code/projects")],
        vscode_user_dir: Vec::new(),
        codex_home: vec![PathBuf::from("fixtures/codex/home")],
    })
    .expect("fixture discovery")
}

fn args(dir: Option<&str>) -> ReportArgs {
    ReportArgs {
        sessions: Vec::new(),
        all: dir.is_none(),
        dir: dir.map(PathBuf::from),
        last: 100,
        since: None,
        harness: None,
        json: true,
        tokenization: TokenizationArg::Heuristic,
        limit: 10,
        sources: SourceArgs {
            session_root: None,
            opencode_db: Vec::new(),
            claude_root: Vec::new(),
            vscode_user_dir: Vec::new(),
            codex_home: Vec::new(),
        },
    }
}

#[test]
fn shell_commands_are_compared_without_a_leading_change_of_directory() {
    let cases = [
        (
            "Bash",
            r#"{"command":"cargo test","description":"Run"}"#,
            "cargo test",
        ),
        (
            "Bash",
            r#"{"command":"cd /a/b && cargo test"}"#,
            "cargo test",
        ),
        ("bash", r#"{"command":"cd /a/b; git status"}"#, "git status"),
        (
            "exec_command",
            r#"{"cmd":"ls -la","workdir":"/x"}"#,
            "ls -la",
        ),
        ("shell", r#"{"command":["bash","-lc","ls"]}"#, "bash -lc ls"),
        (
            "Bash",
            r#"{"command":"cd /only/a/directory"}"#,
            "cd /only/a/directory",
        ),
    ];
    for (tool, arguments, expected) in cases {
        assert_eq!(
            command_key(tool, arguments, &Paths::none()),
            expected,
            "{arguments}"
        );
    }
}

#[test]
fn reads_are_compared_by_path_and_other_tools_by_their_arguments() {
    let cases = [
        (
            "Read",
            r#"{"file_path":"/a.rs","offset":10,"limit":20}"#,
            "/a.rs",
        ),
        ("read", r#"{"path":"a.rs","limit":null}"#, "a.rs"),
        // Keys are sorted and null values left out.
        (
            "Grep",
            r#"{"pattern":"x","path":null,"glob":"*.rs"}"#,
            r#"{"glob":"*.rs","pattern":"x"}"#,
        ),
        ("apply_patch", " *** Begin Patch\n", "*** Begin Patch"),
    ];
    for (tool, arguments, expected) in cases {
        assert_eq!(
            command_key(tool, arguments, &Paths::none()),
            expected,
            "{arguments}"
        );
    }
}

#[test]
fn paths_in_a_sessions_working_tree_are_written_relative_to_its_top_folder() {
    let root = tempfile::tempdir().expect("temporary folder");
    let worktree = root.path().join("worktree");
    fs::create_dir_all(worktree.join("web")).expect("worktree");
    fs::write(worktree.join(".git"), "gitdir: elsewhere\n").expect(".git file");
    let top = worktree.display().to_string();
    let in_web = Paths::for_directory(Some(&format!("{top}/web")));
    let cases = [
        (
            "Read",
            json!({ "file_path": format!("{top}/src/a.rs") }),
            "src/a.rs",
        ),
        (
            "read",
            json!({ "path": "src/App.svelte" }),
            "web/src/App.svelte",
        ),
        ("read", json!({ "path": "/etc/hosts" }), "/etc/hosts"),
        (
            "Bash",
            json!({ "command": format!("cd {top} && sed -n 1,5p {top}/src/a.rs") }),
            "sed -n 1,5p src/a.rs",
        ),
        (
            "Bash",
            json!({ "command": format!("git -C {top} status; ls {top}-old") }),
            "git -C . status; ls TOP-old",
        ),
    ];
    for (tool, arguments, expected) in cases {
        let arguments = arguments.to_string();
        assert_eq!(
            command_key(tool, &arguments, &in_web),
            expected.replace("TOP", &top),
            "{arguments}"
        );
    }
    let gone = Paths::for_directory(Some("/no/such/checkout"));
    assert_eq!(
        command_key("Read", r#"{"file_path":"/no/such/checkout/a.rs"}"#, &gone),
        "a.rs",
        "a folder that no longer exists is its own top folder"
    );
}

#[test]
fn worktrees_of_a_repository_share_its_git_folder() {
    let root = tempfile::tempdir().expect("temporary folder");
    let main = root.path().join("main");
    let git = main.join(".git");
    let worktree_git = git.join("worktrees/feature");
    fs::create_dir_all(&worktree_git).expect("git folders");
    fs::write(worktree_git.join("commondir"), "../..\n").expect("commondir");
    let worktree = root.path().join("feature");
    fs::create_dir_all(worktree.join("src")).expect("worktree");
    fs::write(
        worktree.join(".git"),
        format!("gitdir: {}\n", worktree_git.display()),
    )
    .expect(".git file");
    let elsewhere = root.path().join("elsewhere");
    fs::create_dir_all(&elsewhere).expect("other folder");

    let expected = fs::canonicalize(&git).ok();
    assert!(expected.is_some());
    assert_eq!(
        repository_of(&main.join("nested/folder")),
        expected,
        "a missing folder's ancestors are used"
    );
    assert_eq!(repository_of(&worktree.join("src")), expected);
    assert_eq!(repository_of(&elsewhere), None);
}

#[test]
fn a_directory_scope_keeps_its_sessions_and_their_children() {
    let sessions = fixture_sessions();
    let (_, all) = select(&sessions, &args(None)).expect("all sessions");
    assert_eq!(all.len(), sessions.len(), "every session, each child once");
    let (scope, selected) =
        select(&sessions, &args(Some("/synthetic/project"))).expect("one directory");
    assert_eq!(scope.kind, "directory");
    assert!(!selected.is_empty());
    for (position, session) in selected.iter().enumerate() {
        match &session.parent_reference {
            Some(parent) => assert!(
                selected[..position]
                    .iter()
                    .any(|earlier| &earlier.id == parent),
                "a child session follows its parent"
            ),
            None => assert!(session
                .working_directory
                .as_deref()
                .is_some_and(|dir| dir.starts_with("/synthetic/project"))),
        }
    }
    let (_, none) = select(&sessions, &args(Some("/no/such/project"))).expect("no sessions");
    assert!(none.is_empty());
}

#[test]
fn item_costs_add_up_to_each_sessions_reported_input_cost() {
    let table = pricing::embedded();
    let mut priced = 0;
    for session in fixture_sessions() {
        let (normalized, analysis) =
            analyse(&session.source_locator(), CONFIG).expect("fixture analysis");
        let report = session_report(&session, &normalized, &analysis, &Thresholds::default(), 10);
        let items: f64 = report
            .context_by_kind
            .iter()
            .filter_map(|kind| kind.estimated_cost)
            .sum();
        let input: f64 = analysis
            .model_calls
            .iter()
            .zip(&normalized.model_calls)
            .filter_map(|(call, source)| {
                pricing::input_price(
                    table,
                    CallToPrice {
                        harness: &analysis.session.source,
                        provider: call.provider.as_deref(),
                        model: call.model.as_deref(),
                        at_ms: call.timing.recorded_at_ms.or(call.timing.started_at_ms),
                        usage: &source.reported_usage,
                    },
                )?
                .prompt_cost
            })
            .sum();
        // Kinds under 1% of the tokens are left out of the list, so the totals can
        // differ by a little.
        if input > 0.0 && items > 0.0 {
            priced += 1;
            assert!(
                (items - input).abs() <= input * 0.05,
                "{}: items {items} against input {input}",
                session.id
            );
        }
        let shares: f64 = report.context_by_kind.iter().map(|kind| kind.share).sum();
        assert!(shares <= 1.0 + 1e-9);
    }
    assert!(priced > 0, "some fixtures are priced");
}

#[test]
fn tool_results_are_joined_to_their_sessions_items() {
    let mut runs = 0;
    for session in &fixture_sessions() {
        let (normalized, analysis) =
            analyse(&session.source_locator(), CONFIG).expect("fixture analysis");
        let report = session_report(session, &normalized, &analysis, &Thresholds::default(), 10);
        runs += report.runs.len();
        for run in &report.runs {
            assert_eq!(run.reference, session.id);
            assert!(analysis
                .context_items
                .iter()
                .any(|item| item.id == run.item_id));
        }
    }
    assert!(runs > 0);
}

fn finding(usd: f64) -> Finding {
    Finding {
        pattern: "largeLongLivedResult",
        basis: "estimated",
        estimated_cost: FindingCost {
            usd: Some(usd),
            token_turns: 0,
        },
        summary: String::new(),
        items: Vec::new(),
        facts: BTreeMap::new(),
    }
}

#[test]
fn the_most_expensive_findings_are_kept_over_all_sessions() {
    let sessions = fixture_sessions();
    let mut reports: Vec<_> = sessions
        .iter()
        .take(2)
        .map(|session| {
            let (normalized, analysis) =
                analyse(&session.source_locator(), CONFIG).expect("fixture analysis");
            session_report(session, &normalized, &analysis, &Thresholds::default(), 10)
        })
        .collect();
    reports[0].findings = vec![finding(1.0), finding(5.0)];
    reports[1].findings = vec![finding(3.0), finding(0.5)];
    keep_top(&mut reports, 2);
    let kept: Vec<Vec<f64>> = reports
        .iter()
        .map(|report| {
            report
                .findings
                .iter()
                .filter_map(|finding| finding.estimated_cost.usd)
                .collect()
        })
        .collect();
    assert_eq!(kept, vec![vec![5.0], vec![3.0]]);
}

#[test]
fn installing_the_skill_keeps_a_copy_that_was_changed() {
    let folder = tempfile::tempdir().expect("temporary folder");
    let path = install(folder.path(), false).expect("first install");
    assert_eq!(path, folder.path().join("token-efficiency/SKILL.md"));
    install(folder.path(), false).expect("the same version installs again");
    fs::write(&path, "edited").expect("edit");
    assert!(install(folder.path(), false).is_err());
    install(folder.path(), true).expect("forced install");
    assert_ne!(fs::read_to_string(&path).expect("skill"), "edited");
}

#[test]
fn shell_commands_are_grouped_by_program_and_subcommand() {
    let cases = [
        ("rg -n pattern src", "rg"),
        ("git -C /a/b status --short", "git status"),
        ("npm --prefix web run test -- --run", "npm run test"),
        ("cargo test --all-targets", "cargo test"),
        ("RUST_LOG=debug cargo run --release", "cargo run"),
        ("sudo /usr/bin/time ls -la", "time"),
        ("/usr/local/bin/rg -l x | head", "rg"),
        ("python3 - <<'EOF'", "python3"),
        ("(cd web && npm test)", "cd"),
        ("gh run view 123 --log-failed", "gh run view"),
        ("", ""),
    ];
    for (command, expected) in cases {
        assert_eq!(command_family(command), expected, "{command}");
    }
}

#[test]
fn carried_context_is_conversation_from_three_or_more_user_turns_earlier() {
    for session in fixture_sessions() {
        let (normalized, analysis) =
            analyse(&session.source_locator(), CONFIG).expect("fixture analysis");
        let turns = user_turns(&analysis);
        assert_eq!(turns.len(), analysis.model_calls.len());
        assert!(turns.windows(2).all(|pair| pair[0] <= pair[1]));
        let costs = item_costs(&analysis, &normalized);
        for (item, cost) in analysis.context_items.iter().zip(&costs) {
            assert!(cost.carried.token_turns <= cost.cost.token_turns);
            if cost.carried.token_turns > 0 {
                assert!(
                    ["userMessage", "assistantMessage", "toolResult", "thinking"]
                        .contains(&item.kind.as_str()),
                    "{} is not part of the conversation",
                    item.kind
                );
            }
        }
        if turns.last().copied().unwrap_or(0) < 4 {
            assert!(costs.iter().all(|cost| cost.carried.token_turns == 0));
        }
    }
}

fn run(session: &str, item: &str, command: &str, first_call: usize) -> ToolRun {
    ToolRun {
        tool: "Read".into(),
        family: None,
        first_call,
        command: command.into(),
        failed: false,
        result_hash: None,
        cost: FindingCost {
            usd: Some(0.1),
            token_turns: 100,
        },
        reference: session.into(),
        item_id: item.into(),
        tokens: Some(50),
    }
}

#[test]
fn a_read_whose_result_a_compaction_removed_is_counted_when_it_runs_again() {
    let session = fixture_sessions()
        .into_iter()
        .find(|session| {
            analyse(&session.source_locator(), CONFIG)
                .is_ok_and(|(_, analysis)| !analysis.compactions.is_empty())
        })
        .expect("a fixture with a compaction");
    let (normalized, analysis) =
        analyse(&session.source_locator(), CONFIG).expect("fixture analysis");
    let compaction = &analysis.compactions[0];
    let removed = compaction
        .source_item_ids
        .iter()
        .find(|id| !compaction.retained_item_ids.contains(id))
        .expect("an item the compaction removed");
    let after = compaction.before_model_call;
    let mut report = session_report(&session, &normalized, &analysis, &Thresholds::default(), 10);
    report.runs = vec![
        run(&session.id, removed, "a.rs", 1),
        run(&session.id, "later-1", "a.rs", after),
        run(&session.id, "later-2", "a.rs", after),
        run(&session.id, "removed-never", "b.rs", after),
    ];
    let thresholds = Thresholds {
        reruns_after_compaction: 1,
        ..Thresholds::default()
    };
    let finding = super::findings::reruns_for_test(&analysis, &report.runs, &thresholds)
        .expect("a re-run after the compaction");
    assert_eq!(
        finding.facts["reruns"], 1,
        "only the first re-run of a.rs counts"
    );
    assert_eq!(finding.items[0].item_id, "later-1");
}

#[test]
fn a_fork_reports_only_its_own_turns_and_tool_runs() {
    let root = tempfile::tempdir().expect("temporary folder");
    let folder = root.path().join("--project--");
    fs::create_dir_all(&folder).expect("session folder");
    let at = |time: &str| format!("2026-09-15T{time}.000Z");
    let message = |id: &str, parent: Option<&str>, time: &str, message: serde_json::Value| json!({"type":"message","id":id,"parentId":parent,"timestamp":at(time),"message":message});
    let search = |id: &str| json!({"role":"assistant","content":[{"type":"toolCall","id":id,"name":"bash","arguments":{"command":"rg foo"}}]});
    let result = |id: &str| json!({"role":"toolResult","toolCallId":id,"toolName":"bash","content":[{"type":"text","text":"src/main.rs: foo"}]});
    let parent = folder.join("parent.jsonl");
    let history = [
        message(
            "u1",
            None,
            "10:00:00",
            json!({"role":"user","content":"find foo"}),
        ),
        message("a1", Some("u1"), "10:00:01", search("t1")),
        message("r1", Some("a1"), "10:00:02", result("t1")),
    ];
    let lines = |header: serde_json::Value, records: &[serde_json::Value]| {
        std::iter::once(&header)
            .chain(records)
            .map(|record| format!("{record}\n"))
            .collect::<String>()
    };
    fs::write(
        &parent,
        lines(
            json!({"type":"session","version":3,"id":"parent","timestamp":at("10:00:00"),"cwd":"/project"}),
            &history,
        ),
    )
    .expect("parent session");
    let mut fork = history.to_vec();
    fork.extend([
        message(
            "u2",
            Some("r1"),
            "12:00:01",
            json!({"role":"user","content":"again"}),
        ),
        message("a2", Some("u2"), "12:00:02", search("t2")),
        message("r2", Some("a2"), "12:00:03", result("t2")),
        message(
            "a3",
            Some("r2"),
            "12:00:04",
            json!({"role":"assistant","content":"done"}),
        ),
    ]);
    fs::write(
        folder.join("fork.jsonl"),
        lines(
            json!({"type":"session","version":3,"id":"fork","timestamp":at("12:00:00"),"cwd":"/project",
                "parentSession":parent.display().to_string()}),
            &fork,
        ),
    )
    .expect("fork session");
    let sessions = discover_sessions(SourceArgs {
        session_root: Some(root.path().to_path_buf()),
        opencode_db: Vec::new(),
        claude_root: Vec::new(),
        vscode_user_dir: Vec::new(),
        codex_home: Vec::new(),
    })
    .expect("discovery");
    let session = sessions
        .iter()
        .find(|session| matches!(session.source_locator(), crate::source::SessionLocator::PiFile(path) if path.ends_with("fork.jsonl")))
        .unwrap_or_else(|| panic!("the fork in {sessions:?}"));
    let (normalized, analysis) = analyse(&session.source_locator(), CONFIG).expect("fork analysis");
    let report = session_report(session, &normalized, &analysis, &Thresholds::default(), 10);
    assert_eq!(report.calls, 2, "the parent's call is not the fork's");
    assert_eq!(report.user_turns, 1);
    assert_eq!(report.runs.len(), 1, "the parent's run is not the fork's");
    assert!(
        report.runs[0].item_id.contains("r2"),
        "{}",
        report.runs[0].item_id
    );
}
