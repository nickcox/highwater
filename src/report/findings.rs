//! The patterns a report looks for. Each finding states what was measured; deciding what to
//! change is left to the reader. See docs/report.md.

use super::{
    build::ItemCost,
    types::{CarriedContext, Finding, FindingCost, ItemRef, SessionReport, Thresholds, ToolRun},
};
use crate::{api::Analysis, domain::grouped};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap, HashSet};

/// Items listed for a finding that groups several.
const ITEM_LIMIT: usize = 3;
/// Longest command written in a summary.
const COMMAND_LIMIT: usize = 120;

/// What a session's findings are made from.
pub(super) struct SessionFacts<'a> {
    pub analysis: &'a Analysis,
    pub costs: &'a [ItemCost],
    pub runs: &'a [ToolRun],
    pub carried: &'a CarriedContext,
    pub turns: usize,
    pub average_context_tokens: Option<u64>,
}

pub(super) fn session_findings(
    facts: &SessionFacts<'_>,
    thresholds: &Thresholds,
    limit: usize,
) -> Vec<Finding> {
    let mut findings =
        large_long_lived_results(facts.analysis, facts.costs, facts.runs, thresholds, limit);
    findings.extend(repeated_commands(facts.runs, thresholds, limit));
    findings.extend(carried_context(facts, thresholds));
    findings.extend(reruns_after_compactions(
        facts.analysis,
        facts.runs,
        thresholds,
    ));
    findings
}

/// Much of the session's input went on conversation from several user turns earlier.
fn carried_context(facts: &SessionFacts<'_>, thresholds: &Thresholds) -> Option<Finding> {
    let carried = facts.carried;
    if carried.share < thresholds.carried_share {
        return None;
    }
    let cost = carried
        .estimated_cost
        .map_or_else(String::new, |usd| format!(" (${usd:.2})"));
    Some(Finding {
        pattern: "carriedContext",
        basis: "estimated",
        estimated_cost: FindingCost {
            usd: carried.estimated_cost,
            token_turns: carried.token_turns,
        },
        summary: format!(
            "{:.0}% of the input{cost} went on conversation from {} or more user turns earlier, over {} user turns",
            carried.share * 100.0,
            carried.older_than_turns,
            facts.turns
        ),
        items: Vec::new(),
        facts: BTreeMap::from([
            ("share", json!((carried.share * 1000.0).round() / 1000.0)),
            ("olderThanTurns", json!(carried.older_than_turns)),
            ("userTurns", json!(facts.turns)),
            ("calls", json!(facts.analysis.model_calls.len())),
            ("averageContextTokens", json!(facts.average_context_tokens)),
            ("compactions", json!(facts.analysis.compactions.len())),
        ]),
    })
}

/// Commands and file reads run again after a compaction removed their earlier results,
/// before the next compaction, over all the session's compactions.
fn reruns_after_compactions(
    analysis: &Analysis,
    runs: &[ToolRun],
    thresholds: &Thresholds,
) -> Option<Finding> {
    let mut reruns: Vec<&ToolRun> = Vec::new();
    let mut compactions = 0;
    for (position, compaction) in analysis.compactions.iter().enumerate() {
        let start = compaction.before_model_call;
        let end = analysis
            .compactions
            .get(position + 1)
            .map_or(usize::MAX, |next| next.before_model_call);
        let retained: HashSet<&str> = compaction
            .retained_item_ids
            .iter()
            .map(String::as_str)
            .collect();
        let removed: HashSet<&str> = compaction
            .source_item_ids
            .iter()
            .map(String::as_str)
            .filter(|id| !retained.contains(id))
            .collect();
        let removed_keys: HashSet<(&str, &str)> = runs
            .iter()
            .filter(|run| !run.command.is_empty() && removed.contains(run.item_id.as_str()))
            .map(|run| (run.tool.as_str(), run.command.as_str()))
            .collect();
        // The first re-run of each command counts; later ones are `repeatedCommand`'s.
        let mut seen = HashSet::new();
        let before = reruns.len();
        reruns.extend(
            runs.iter()
                .filter(|run| (start..end).contains(&run.first_call))
                .filter(|run| {
                    let key = (run.tool.as_str(), run.command.as_str());
                    removed_keys.contains(&key) && seen.insert(key)
                }),
        );
        compactions += usize::from(reruns.len() > before);
    }
    if reruns.len() < thresholds.reruns_after_compaction {
        return None;
    }
    let result_tokens: u64 = reruns.iter().map(|run| run.tokens.unwrap_or(0)).sum();
    // The commands run again after the most compactions, then the most expensive.
    let mut commands: HashMap<String, (usize, f64)> = HashMap::new();
    for run in &reruns {
        let entry = commands
            .entry(describe(&run.tool, &run.command))
            .or_default();
        entry.0 += 1;
        entry.1 += run.cost.rank();
    }
    let mut commands: Vec<(String, (usize, f64))> = commands.into_iter().collect();
    commands.sort_by(|a, b| b.1 .0.cmp(&a.1 .0).then(b.1 .1.total_cmp(&a.1 .1)));
    Some(Finding {
        pattern: "rerunAfterCompaction",
        basis: "measured",
        estimated_cost: total_cost(&reruns),
        summary: format!(
            "After {} of its {} compactions, {} commands or file reads whose results the compaction removed ran again ({} tokens)",
            compactions,
            analysis.compactions.len(),
            reruns.len(),
            grouped(result_tokens)
        ),
        items: reruns
            .iter()
            .take(ITEM_LIMIT)
            .map(|run| run.item(false))
            .collect(),
        facts: BTreeMap::from([
            ("compactions", json!(analysis.compactions.len())),
            ("reruns", json!(reruns.len())),
            ("resultTokens", json!(result_tokens)),
            (
                "commands",
                json!(commands
                    .iter()
                    .take(5)
                    .map(|(command, (count, _))| json!({ "command": command, "compactions": count }))
                    .collect::<Vec<_>>()),
            ),
        ]),
    })
}

/// A large tool result that stayed in context for many calls.
fn large_long_lived_results(
    analysis: &Analysis,
    costs: &[ItemCost],
    runs: &[ToolRun],
    thresholds: &Thresholds,
    limit: usize,
) -> Vec<Finding> {
    let commands: HashMap<&str, &ToolRun> =
        runs.iter().map(|run| (run.item_id.as_str(), run)).collect();
    let mut findings: Vec<Finding> = analysis
        .context_items
        .iter()
        .zip(costs)
        .filter(|(item, cost)| {
            item.kind == "toolResult"
                && cost.tokens.unwrap_or(0) >= thresholds.large_result_tokens
                && cost.present_calls >= thresholds.long_lived_calls
        })
        .map(|(item, cost)| {
            let run = commands.get(item.id.as_str());
            let mut facts = BTreeMap::from([
                ("tokens", json!(cost.tokens)),
                ("presentCalls", json!(cost.present_calls)),
                ("firstCall", json!(cost.first_call)),
                (
                    "lastCall",
                    json!(item.presence.last().map(|range| range.end_call)),
                ),
            ]);
            if let Some(run) = run {
                facts.insert("tool", json!(run.tool));
            }
            Finding {
                pattern: "largeLongLivedResult",
                basis: "estimated",
                estimated_cost: cost.cost,
                summary: format!(
                    "{} ({} tokens) stayed in context for {} calls",
                    item.label,
                    grouped(cost.tokens.unwrap_or(0)),
                    cost.present_calls
                ),
                items: vec![ItemRef {
                    reference: None,
                    item_id: item.id.clone(),
                }],
                facts,
            }
        })
        .collect();
    rank(&mut findings, limit);
    findings
}

/// Runs of one tool with the same command or arguments.
struct Group<'a> {
    tool: &'a str,
    command: &'a str,
    runs: Vec<&'a ToolRun>,
}

fn groups(runs: &[ToolRun]) -> Vec<Group<'_>> {
    let mut groups: Vec<Group<'_>> = Vec::new();
    let mut positions: HashMap<(&str, &str), usize> = HashMap::new();
    for run in runs.iter().filter(|run| !run.command.is_empty()) {
        let key = (run.tool.as_str(), run.command.as_str());
        let position = *positions.entry(key).or_insert_with(|| {
            groups.push(Group {
                tool: key.0,
                command: key.1,
                runs: Vec::new(),
            });
            groups.len() - 1
        });
        groups[position].runs.push(run);
    }
    groups
}

fn total_cost<'a>(runs: impl IntoIterator<Item = &'a &'a ToolRun>) -> FindingCost {
    let mut cost = FindingCost::default();
    for run in runs {
        cost.add(run.cost);
    }
    cost
}

/// A command run several times in one session. Runs whose result matches an earlier run's
/// exactly are counted, since those added nothing new.
fn repeated_commands(runs: &[ToolRun], thresholds: &Thresholds, limit: usize) -> Vec<Finding> {
    let mut findings: Vec<Finding> = groups(runs)
        .into_iter()
        .filter_map(|group| {
            let mut seen = HashSet::new();
            let identical = group
                .runs
                .iter()
                .filter(|run| run.result_hash.is_some_and(|hash| !seen.insert(hash)))
                .count();
            if group.runs.len() < thresholds.repeated_runs && identical == 0 {
                return None;
            }
            let failed = group.runs.iter().filter(|run| run.failed).count();
            let result_tokens: u64 = group.runs.iter().map(|run| run.tokens.unwrap_or(0)).sum();
            Some(Finding {
                pattern: "repeatedCommand",
                basis: "measured",
                estimated_cost: total_cost(&group.runs),
                summary: format!(
                    "{} ran {} times{}",
                    describe(group.tool, group.command),
                    group.runs.len(),
                    if identical > 0 {
                        format!(", {identical} with the same result as an earlier run")
                    } else {
                        String::new()
                    }
                ),
                items: group
                    .runs
                    .iter()
                    .take(ITEM_LIMIT)
                    .map(|run| run.item(false))
                    .collect(),
                facts: BTreeMap::from([
                    ("tool", json!(group.tool)),
                    ("command", json!(shorten(group.command))),
                    ("runs", json!(group.runs.len())),
                    ("identicalResults", json!(identical)),
                    ("failed", json!(failed)),
                    ("resultTokens", json!(result_tokens)),
                ]),
            })
        })
        .collect();
    rank(&mut findings, limit);
    findings
}

/// A command run in several of the reported sessions.
pub(super) fn across_sessions(
    reports: &[SessionReport],
    thresholds: &Thresholds,
    limit: usize,
) -> Vec<Finding> {
    let runs: Vec<ToolRun> = reports
        .iter()
        .flat_map(|report| report.runs.iter().cloned())
        .collect();
    let mut findings: Vec<Finding> = groups(&runs)
        .into_iter()
        .filter_map(|group| {
            let sessions: Vec<&str> =
                super::distinct(group.runs.iter().map(|run| run.reference.as_str()));
            if sessions.len() < thresholds.repeated_sessions {
                return None;
            }
            let result_tokens: u64 = group.runs.iter().map(|run| run.tokens.unwrap_or(0)).sum();
            // One example from each of the first few sessions.
            let mut examples = Vec::new();
            let mut listed = HashSet::new();
            for run in &group.runs {
                if examples.len() < ITEM_LIMIT && listed.insert(run.reference.as_str()) {
                    examples.push(run.item(true));
                }
            }
            Some(Finding {
                pattern: "repeatedCommand",
                basis: "measured",
                estimated_cost: total_cost(&group.runs),
                summary: format!(
                    "{} ran {} times in {} sessions",
                    describe(group.tool, group.command),
                    group.runs.len(),
                    sessions.len()
                ),
                items: examples,
                facts: BTreeMap::from([
                    ("tool", json!(group.tool)),
                    ("command", json!(shorten(group.command))),
                    ("runs", json!(group.runs.len())),
                    ("sessions", json!(sessions.len())),
                    ("resultTokens", json!(result_tokens)),
                    (
                        "failed",
                        Value::from(group.runs.iter().filter(|run| run.failed).count()),
                    ),
                ]),
            })
        })
        .collect();
    rank(&mut findings, limit);
    findings
}

/// Keeps the `limit` most expensive findings of each pattern over all the sessions.
pub(super) fn keep_top(reports: &mut [SessionReport], limit: usize) {
    let mut by_pattern: HashMap<&str, Vec<(f64, usize, usize)>> = HashMap::new();
    for (session, report) in reports.iter().enumerate() {
        for (position, finding) in report.findings.iter().enumerate() {
            by_pattern.entry(finding.pattern).or_default().push((
                finding.estimated_cost.rank(),
                session,
                position,
            ));
        }
    }
    let mut keep = HashSet::new();
    for findings in by_pattern.values_mut() {
        findings.sort_by(|a, b| b.0.total_cmp(&a.0));
        keep.extend(
            findings
                .iter()
                .take(limit)
                .map(|&(_, session, position)| (session, position)),
        );
    }
    for (session, report) in reports.iter_mut().enumerate() {
        let mut position = 0;
        report.findings.retain(|_| {
            position += 1;
            keep.contains(&(session, position - 1))
        });
    }
}

/// Most expensive first, keeping `limit`.
fn rank(findings: &mut Vec<Finding>, limit: usize) {
    findings.sort_by(|a, b| b.estimated_cost.rank().total_cmp(&a.estimated_cost.rank()));
    findings.truncate(limit);
}

fn describe(tool: &str, command: &str) -> String {
    format!("{tool} `{}`", shorten(command))
}

/// The command's first line, cut at `COMMAND_LIMIT` characters.
fn shorten(command: &str) -> String {
    let line = command.lines().next().unwrap_or_default();
    let mut shortened: String = line.chars().take(COMMAND_LIMIT).collect();
    if shortened.len() < command.len() {
        shortened.push('…');
    }
    shortened
}

#[cfg(test)]
pub(super) fn reruns_for_test(
    analysis: &Analysis,
    runs: &[ToolRun],
    thresholds: &Thresholds,
) -> Option<Finding> {
    reruns_after_compactions(analysis, runs, thresholds)
}
