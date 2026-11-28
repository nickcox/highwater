use super::*;
use std::{io::Write, time::Instant};

fn file(contents: impl AsRef<[u8]>) -> tempfile::NamedTempFile {
    let mut file = tempfile::NamedTempFile::new().unwrap();
    file.write_all(contents.as_ref()).unwrap();
    file
}

fn number(path: &Path, limit: usize) -> Option<u64> {
    last_record(path, limit, |record| record.get("number")?.as_u64()).unwrap()
}

#[test]
fn reads_the_latest_complete_match() {
    let contents = file("{\"number\":1}\nnot json\n{\"number\":2}\r\n{}\n{\"number\":3}");
    assert_eq!(number(contents.path(), TAIL_LIMIT), Some(2));
    let contents = file("{\"number\":4}\n");
    assert_eq!(number(contents.path(), TAIL_LIMIT), Some(4));
    let contents = file("{\"number\":4}");
    assert_eq!(number(contents.path(), TAIL_LIMIT), None);
}

#[test]
fn finds_records_across_blocks_and_past_large_unfinished_lines() {
    let contents = file(format!(
        "{{\"number\":5,\"unused\":\"{}\"}}\n{}",
        "x".repeat(FIRST_BLOCK * 3),
        "y".repeat(FIRST_BLOCK * 3),
    ));
    assert_eq!(number(contents.path(), TAIL_LIMIT), Some(5));
    assert_eq!(number(contents.path(), FIRST_BLOCK * 4), None);
}

#[test]
fn does_not_parse_a_fragment_at_the_limit() {
    let suffix = "{\"number\":6}\n";
    let contents = file(format!("garbage {suffix}"));
    assert_eq!(number(contents.path(), suffix.len()), None);
    let contents = file(format!("ignored\n{suffix}"));
    assert_eq!(number(contents.path(), suffix.len() + 1), Some(6));
}

#[test]
fn copilot_ignores_replayed_subagent_and_invalid_checkpoints() {
    let contents = file(concat!(
        "{\"type\":\"session.usage_checkpoint\",\"data\":{\"totalNanoAiu\":2500000000}}\n",
        "{\"type\":\"session.usage_checkpoint\",\"checkpoint\":true,\"data\":{\"totalNanoAiu\":0}}\n",
        "{\"type\":\"session.usage_checkpoint\",\"agentId\":\"a\",\"data\":{\"totalNanoAiu\":0}}\n",
        "{\"type\":\"session.usage_checkpoint\",\"data\":{\"totalNanoAiu\":-1}}\n",
    ));
    assert_eq!(
        copilot_total(contents.path()).unwrap(),
        Some(HarnessSessionCost {
            total_usd: 0.025,
            since_ms: None,
        }),
    );
}

#[test]
fn claude_code_uses_the_last_cost_state_period() {
    let contents = file(concat!(
        "{\"type\":\"cost-state\",\"totalCostUSD\":9,\"startTime\":1000}\n",
        "{\"type\":\"cost-state\",\"totalCostUSD\":1.25,\"startTime\":2000}\n",
        "{\"type\":\"assistant\"}\n",
    ));
    assert_eq!(
        claude_code_total(contents.path()).unwrap(),
        Some(ClaudeCodeTotal {
            cost: HarnessSessionCost {
                total_usd: 1.25,
                since_ms: Some(2000)
            },
            newer_usage: false,
            through_ms: None,
        }),
    );
    let contents = file(concat!(
        "{\"type\":\"cost-state\",\"totalCostUSD\":9}\n",
        "{\"type\":\"cost-state\",\"totalCostUSD\":-1}\n",
    ));
    assert_eq!(claude_code_total(contents.path()).unwrap(), None);
}

#[test]
fn claude_code_finds_a_total_beyond_the_tail() {
    let contents = file(format!(
        "{{\"type\":\"cost-state\",\"totalCostUSD\":9}}\n\
         {{\"type\":\"cost-state\",\"totalCostUSD\":1.25}}\n{}\n\
         {{\"type\":\"cost-state\",\"totalCostUSD\":4}}",
        "{}\n".repeat(TAIL_LIMIT / 3 + 1),
    ));
    let total = claude_code_total(contents.path()).unwrap().unwrap();
    assert_eq!(total.cost.total_usd, 1.25);
    assert!(!total.newer_usage);
}

#[test]
fn claude_code_flags_usage_after_the_checkpoint_in_both_read_paths() {
    let usage =
        "{\"type\":\"assistant\",\"message\":{\"usage\":{\"cache_read_input_tokens\":12}}}\n";
    let checkpoint = "{\"type\":\"cost-state\",\"totalCostUSD\":1.25}\n";
    let padding = "{}\n".repeat(TAIL_LIMIT / 3 + 1);
    for text in [
        format!("{checkpoint}{usage}"),
        format!("{checkpoint}{usage}{padding}"),
        format!("{checkpoint}{padding}{usage}"),
    ] {
        let contents = file(text);
        assert!(
            claude_code_total(contents.path())
                .unwrap()
                .unwrap()
                .newer_usage
        );
    }
    let dated_usage = "{\"type\":\"assistant\",\"timestamp\":\"2026-10-21T08:35:20Z\",\"message\":{\"usage\":{\"cache_read_input_tokens\":12}}}\n";
    let cutoff = chrono::DateTime::parse_from_rfc3339("2026-10-21T08:35:20Z")
        .unwrap()
        .timestamp_millis();
    for gap in ["", padding.as_str()] {
        let contents = file(format!("{dated_usage}{checkpoint}{gap}{usage}"));
        let total = claude_code_total(contents.path()).unwrap().unwrap();
        assert!(total.newer_usage);
        assert_eq!(total.through_ms, Some(cutoff));
    }
    let contents = file(format!("{usage}{checkpoint}{usage}{checkpoint}"));
    assert!(
        !claude_code_total(contents.path())
            .unwrap()
            .unwrap()
            .newer_usage
    );
}

#[test]
fn pi_counts_abandoned_responses_and_compaction_but_not_unfinished_lines() {
    let contents = file(concat!(
        "{\"type\":\"message\",\"message\":{\"role\":\"assistant\",\"usage\":{\"cost\":{\"total\":0.25}}}}\n",
        "{\"type\":\"message\",\"message\":{\"role\":\"assistant\",\"usage\":{\"cost\":{\"total\":0.5}}}}\n",
        "{\"type\":\"compaction\",\"usage\":{\"cost\":{\"total\":0.125}}}\n",
        "{\"type\":\"branch_summary\",\"usage\":{\"cost\":{\"total\":5}}}\n",
        "{\"type\":\"compaction\",\"usage\":{\"cost\":{\"total\":9}}}",
    ));
    assert_eq!(pi_total(contents.path()).unwrap(), Some(0.875));
    assert_eq!(pi_total(file("{}\n").path()).unwrap(), None);
}

#[test]
fn opencode_sums_one_copy_in_legacy_and_modern_layouts() {
    let db = file("");
    let writer = rusqlite::Connection::open(db.path()).unwrap();
    let total = |id| {
        crate::opencode::storage::session_totals(db.path(), id)
            .unwrap()
            .0
            .unwrap()
    };
    writer
        .execute_batch(include_str!("../../fixtures/opencode/legacy-schema.sql"))
        .unwrap();
    writer
        .execute_batch(include_str!("../../fixtures/opencode/simple.sql"))
        .unwrap();
    assert!((total("ses_synthetic") - 0.20).abs() < 1e-12);
    writer
        .execute_batch(include_str!("../../fixtures/opencode/modern-schema.sql"))
        .unwrap();
    writer
        .execute_batch(include_str!("../../fixtures/opencode/modern.sql"))
        .unwrap();
    assert!((total("ses_modern") - 0.03).abs() < 1e-12);
    assert!((total("ses_synthetic") - 0.20).abs() < 1e-12);
}

#[test]
fn opencode_counts_the_calls_the_replay_counts() {
    let db = file("");
    let writer = rusqlite::Connection::open(db.path()).unwrap();
    for script in [
        include_str!("../../fixtures/opencode/legacy-schema.sql"),
        include_str!("../../fixtures/opencode/simple.sql"),
        include_str!("../../fixtures/opencode/modern-schema.sql"),
        include_str!("../../fixtures/opencode/modern.sql"),
        // A compaction with recorded usage is a call; one without is not.
        "INSERT INTO session_message VALUES ('msg_usage_compaction', 'ses_modern', 'compaction', 7, 70, 75,
            '{\"status\":\"failed\",\"reason\":\"auto\",\"time\":{\"created\":70},\"cost\":0.01,\"tokens\":{\"input\":900,\"output\":1,\"reasoning\":0,\"cache\":{\"read\":0,\"write\":0}}}');",
    ] {
        writer.execute_batch(script).unwrap();
    }
    for id in ["ses_synthetic", "ses_modern"] {
        let (_, calls) = crate::opencode::storage::session_totals(db.path(), id).unwrap();
        let replayed = crate::source::load(
            &crate::source::SessionLocator::OpenCode {
                database: db.path().into(),
                native_id: id.into(),
            },
            None,
        )
        .unwrap();
        assert_eq!(
            calls,
            SessionCalls::of(&replayed.normalized.model_calls),
            "{id}"
        );
    }
    let (_, modern) = crate::opencode::storage::session_totals(db.path(), "ses_modern").unwrap();
    assert_eq!(modern.count, 4);
    assert_eq!(modern.peak_input, Some(900));
    assert_eq!(
        modern.models,
        [ModelCalls {
            model: "gpt-4.1".into(),
            calls: 3
        }]
    );
}

#[test]
fn call_figures_leave_out_placeholder_models_and_incomplete_inputs() {
    let calls = SessionCalls::from_calls([
        (Some("small"), Some(10)),
        (Some("<synthetic>"), None),
        (Some("large"), Some(300)),
        (Some("small"), None),
        (None, Some(20)),
        (Some("large"), Some(200)),
        (Some("other"), Some(5)),
    ]);
    assert_eq!(calls.count, 7);
    assert_eq!(calls.peak_input, Some(300));
    assert_eq!(
        calls
            .models
            .iter()
            .map(|model| (model.model.as_str(), model.calls))
            .collect::<Vec<_>>(),
        [("large", 2), ("small", 2), ("other", 1)]
    );
    assert_eq!(
        serde_json::to_value(SessionCalls::from_calls([(Some("m"), None)])).unwrap(),
        serde_json::json!({"count": 1, "peakInput": null, "models": [{"model": "m", "calls": 1}]})
    );
}

#[test]
fn codex_estimate_uses_the_recorded_model_rates() {
    let path = Path::new(concat!(
        "../../fixtures/codex/home/sessions/2026/10/01/",
        "rollout-2026-10-01T10-00-00-01a10000-0000-7000-8000-000000000001.jsonl"
    ));
    let path = Path::new(file!()).parent().unwrap().join(path);
    let loaded = crate::codex::load(&path).unwrap();
    let (usd, partial) = codex_total(&loaded.session).expect("priced calls");
    assert!(usd > 0.0);
    assert!(!partial);
}

#[test]
#[ignore = "reads explicitly configured local logs and reports aggregate timings"]
fn benchmark_local_tail_totals() {
    type Reader = fn(&Path) -> io::Result<Option<HarnessSessionCost>>;
    let mut jobs: Vec<_> = Vec::new();
    if let Some(root) = std::env::var_os("HIGHWATER_BENCH_CLAUDE_ROOT") {
        jobs.extend(
            claude_code::discovery::find_files(Path::new(&root), None)
                .expect("discover Claude Code transcripts")
                .into_iter()
                .map(|file| {
                    (
                        file.modified,
                        file.path,
                        (|path| claude_code_total(path).map(|total| total.map(|total| total.cost)))
                            as Reader,
                    )
                }),
        );
    }
    if let Some(home) = std::env::var_os("HIGHWATER_BENCH_COPILOT_HOME") {
        jobs.extend(
            copilot::discovery::find_files(Path::new(&home), None)
                .expect("discover Copilot logs")
                .into_iter()
                .map(|file| (file.modified, file.path, copilot_total as Reader)),
        );
    }
    assert!(!jobs.is_empty(), "set a benchmark source with local logs");
    jobs.sort_by_key(|(modified, _, _)| std::cmp::Reverse(*modified));
    let started = Instant::now();
    let mut found = 0;
    let mut errors = 0;
    for (i, (_, path, read)) in jobs.iter().enumerate() {
        match read(path) {
            Ok(Some(_)) => {
                found += 1;
                if found == 1 || found == 10 {
                    eprintln!("first {found} totals: {:?}", started.elapsed());
                }
            }
            Ok(None) => {}
            Err(_) => errors += 1,
        }
        if i == 9 {
            eprintln!("first 10 files checked: {:?}", started.elapsed());
        }
    }
    eprintln!(
        "{} files, {found} totals, {errors} read errors: {:?}",
        jobs.len(),
        started.elapsed(),
    );
}
