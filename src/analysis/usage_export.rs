//! Writes, for each step between two consecutive Claude calls in the local sessions, the
//! reported prompt growth and TokenPlume's estimate for each item added. Driven by
//! `scripts/measure-claude-usage.py`; the export holds sizes and item kinds, never content.

use super::*;
use crate::source::{load, SessionLocator};
use std::{io::Write, path::Path, path::PathBuf};

fn local_sessions() -> Vec<(&'static str, SessionLocator)> {
    let home = PathBuf::from(std::env::var_os("HOME").expect("HOME is set"));
    let claude_root = std::env::var_os("CLAUDE_CONFIG_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join(".claude"))
        .join("projects");
    let mut sessions = Vec::new();
    for file in crate::claude_code::discovery::find_files(&claude_root, None).unwrap_or_default() {
        sessions.push((
            "claude-code",
            SessionLocator::ClaudeCodeFile {
                path: file.path,
                kind: file.kind,
            },
        ));
    }
    fn walk(path: &Path, sessions: &mut Vec<(&'static str, SessionLocator)>) {
        for entry in std::fs::read_dir(path).into_iter().flatten().flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk(&path, sessions);
            } else if path.extension().and_then(|extension| extension.to_str()) == Some("jsonl") {
                sessions.push(("pi", SessionLocator::PiFile(path)));
            }
        }
    }
    walk(&home.join(".pi/agent/sessions"), &mut sessions);
    sessions
}

fn is_claude(model: Option<&str>) -> bool {
    model.is_some_and(|model| claude_keeps_prior_thinking(model).is_some())
}

/// A step is kept when both calls are to the same Claude model, the second call only adds
/// items (no compaction, nothing dropped) and both report their prompt size.
#[test]
#[ignore = "reads local sessions; run through scripts/measure-claude-usage.py"]
fn export_claude_usage_steps() {
    let path = std::env::var("TOKENPLUME_USAGE_EXPORT")
        .expect("TOKENPLUME_USAGE_EXPORT names the output file");
    let mut output = std::io::BufWriter::new(std::fs::File::create(path).expect("output file"));
    let mut written = 0;
    for (harness, locator) in local_sessions() {
        let Ok(loaded) = load(&locator, None) else {
            continue;
        };
        if !loaded
            .normalized
            .model_calls
            .iter()
            .any(|call| is_claude(call.target.model.as_deref()))
        {
            continue;
        }
        let config = AnalysisConfig {
            tokenization: TokenizationPolicy::Auto,
            perf_diagnostics: false,
            claude_code_billing: Default::default(),
        };
        let Ok(analysis) = analyze(loaded.normalized, config) else {
            continue;
        };
        for pair in analysis.model_calls.windows(2) {
            let (previous, current) = (&pair[0], &pair[1]);
            if !is_claude(current.model.as_deref())
                || previous.model != current.model
                || current.compaction_before.is_some()
                || !current.dropped_item_indexes.is_empty()
                || current.added_item_indexes.is_empty()
            {
                continue;
            }
            let (Some(before), Some(after)) = (
                previous.reported_prompt_tokens,
                current.reported_prompt_tokens,
            ) else {
                continue;
            };
            let items: Vec<_> = current
                .added_item_indexes
                .iter()
                .map(|index| {
                    let item = &analysis.context_items[*index];
                    let tokens = item
                        .token_estimates
                        .iter()
                        .find(|estimate| {
                            Some(&estimate.profile_id) == current.tokenization_profile_id.as_ref()
                        })
                        .and_then(|estimate| estimate.tokens);
                    serde_json::json!({ "kind": item.kind, "tokens": tokens })
                })
                .collect();
            let step = serde_json::json!({
                "harness": harness,
                "model": current.model,
                "growth": after as i64 - before as i64,
                "items": items,
            });
            writeln!(output, "{step}").expect("write step");
            written += 1;
        }
    }
    output.flush().expect("flush");
    eprintln!("steps written: {written}");
}
