//! The patterns a report looks for. Each finding states what was measured; deciding what to
//! change is left to the reader. See docs/report.md.

use super::{
    build::{has_output_limit, ItemCost, LIMITABLE_FAMILIES},
    text::plural,
    types::{CarriedContext, Finding, FindingCost, ItemRef, SessionReport, Thresholds, ToolRun},
};
use crate::{
    api::{Analysis, EconomicsCompleteness, ModelCall, Range},
    domain::grouped,
    pricing::InputPrice,
};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap, HashSet};

/// Items listed for a finding that groups several.
const ITEM_LIMIT: usize = 3;
/// Longest command written in a summary.
const COMMAND_LIMIT: usize = 120;
/// Calls listed for a `cacheMiss` finding.
const CALL_LIMIT: usize = 5;
/// How long a provider keeps a cached prompt after its last use, in milliseconds: one hour
/// for sessions that wrote one-hour cache entries, otherwise five minutes. Five minutes is
/// approximate for providers without a fixed lifetime, such as OpenAI.
const CACHE_LIFETIME_MS: i64 = 5 * 60 * 1000;
const ONE_HOUR_CACHE_LIFETIME_MS: i64 = 60 * 60 * 1000;

/// What a session's findings are made from.
pub(super) struct SessionFacts<'a> {
    pub analysis: &'a Analysis,
    /// Each call's input prices, in call order.
    pub prices: &'a [Option<InputPrice>],
    pub costs: &'a [ItemCost],
    pub runs: &'a [ToolRun],
    pub carried: &'a CarriedContext,
    pub turns: usize,
    pub average_context_tokens: Option<u64>,
    pub average_context_recorded_calls: usize,
}

pub(super) fn session_findings(
    facts: &SessionFacts<'_>,
    thresholds: &Thresholds,
    limit: usize,
) -> Vec<Finding> {
    let mut findings =
        large_long_lived_results(facts.analysis, facts.costs, facts.runs, thresholds, limit);
    findings.extend(repeated_commands(facts.runs, thresholds, limit));
    findings.extend(repeated_results_in_context(
        facts.analysis,
        facts.runs,
        thresholds,
        limit,
    ));
    findings.extend(large_unlimited_outputs(facts.runs, thresholds, limit));
    findings.extend(carried_context(facts, thresholds));
    findings.extend(reruns_after_compactions(
        facts.analysis,
        facts.runs,
        thresholds,
    ));
    findings.extend(cache_misses(facts.analysis, facts.prices, thresholds));
    findings
}

/// Whether two adjacent calls can be compared for cache reads, by the rules the call
/// economics use for a change in cache read ratio: the same provider, model and API, complete
/// usage under the same pricing policy, no compaction between them and neither retried.
fn comparable(previous: &ModelCall, call: &ModelCall) -> bool {
    let complete = |call: &ModelCall| {
        call.economics.usage_completeness == EconomicsCompleteness::Complete
            && call.economics.prompt_tokens.is_some()
    };
    previous.provider == call.provider
        && previous.model == call.model
        && previous.api == call.api
        && previous.economics.policy_id.is_some()
        && previous.economics.policy_id == call.economics.policy_id
        && complete(previous)
        && complete(call)
        && call.usage.cache_read.is_some()
        && call.compaction_before.is_none()
        && !previous.retried
        && !call.retried
}

/// The time from the end of the previous call to the start of this one, in milliseconds.
/// When the start is not recorded, the time between the two calls' ends, which also
/// includes this call's own generation time.
fn pause_ms(previous: &ModelCall, call: &ModelCall) -> Option<i64> {
    let end = previous.timing.recorded_at_ms?;
    call.timing
        .started_at_ms
        .or(call.timing.recorded_at_ms)
        .map(|start| start - end)
}

/// Calls that read much less from the cache than the previous call's prompt, outside a
/// compaction, with the likely cause of each.
fn cache_misses(
    analysis: &Analysis,
    prices: &[Option<InputPrice>],
    thresholds: &Thresholds,
) -> Option<Finding> {
    let lifetime_ms = if analysis
        .model_calls
        .iter()
        .any(|call| call.usage.cache_write_1h.unwrap_or(0) > 0)
    {
        ONE_HOUR_CACHE_LIFETIME_MS
    } else {
        CACHE_LIFETIME_MS
    };
    struct Miss {
        call: usize,
        shortfall: u64,
        cause: &'static str,
        pause_ms: Option<i64>,
    }
    let mut misses = Vec::new();
    let mut cost = FindingCost::default();
    for (position, pair) in analysis.model_calls.windows(2).enumerate() {
        let [previous, call] = pair else {
            continue;
        };
        if !comparable(previous, call) {
            continue;
        }
        let (Some(previous_prompt), Some(prompt), Some(read)) = (
            previous.economics.prompt_tokens,
            call.economics.prompt_tokens,
            call.usage.cache_read,
        ) else {
            continue;
        };
        let expected = previous_prompt.min(prompt);
        let shortfall = expected.saturating_sub(read);
        if shortfall < thresholds.cache_miss_tokens
            || (shortfall as f64) < expected as f64 * thresholds.cache_miss_share
        {
            continue;
        }
        let pause_ms = pause_ms(previous, call);
        let cause = match pause_ms {
            None => "unknownTiming",
            Some(pause) if pause > lifetime_ms => "afterPause",
            Some(_) => "unexplained",
        };
        // A provider without a cache write rate charges the input rate instead.
        let usd = prices
            .get(position + 1)
            .copied()
            .flatten()
            .map(|price| shortfall as f64 * (price.cache_write - price.cache_read).max(0.0));
        cost.add(FindingCost {
            usd,
            token_turns: shortfall,
        });
        misses.push(Miss {
            call: call.index,
            shortfall,
            cause,
            pause_ms,
        });
    }
    if misses.is_empty() {
        return None;
    }
    let count = |cause: &str| misses.iter().filter(|miss| miss.cause == cause).count();
    let (unexplained, after_pause, unknown) = (
        count("unexplained"),
        count("afterPause"),
        count("unknownTiming"),
    );
    let shortfall: u64 = misses.iter().map(|miss| miss.shortfall).sum();
    let causes: Vec<String> = [
        (after_pause, "after a pause longer than the cache lifetime"),
        (unexplained, "unexplained"),
        (unknown, "with no timing recorded"),
    ]
    .iter()
    .filter(|(count, _)| *count > 0)
    .map(|(count, cause)| format!("{count} {cause}"))
    .collect();
    let mut largest: Vec<&Miss> = misses.iter().collect();
    largest.sort_by_key(|miss| std::cmp::Reverse(miss.shortfall));
    let providers = super::distinct(
        analysis
            .model_calls
            .iter()
            .filter(|call| misses.iter().any(|miss| miss.call == call.index))
            .filter_map(|call| call.provider.as_deref()),
    );
    Some(Finding {
        pattern: "cacheMiss",
        basis: "estimated",
        estimated_cost: cost,
        summary: format!(
            "{} read much less from the cache than the call before ({} tokens): {}",
            plural(misses.len(), "call"),
            grouped(shortfall),
            causes.join(", ")
        ),
        items: Vec::new(),
        facts: BTreeMap::from([
            ("providers", json!(providers)),
            ("misses", json!(misses.len())),
            ("afterPause", json!(after_pause)),
            ("unexplained", json!(unexplained)),
            ("unknownTiming", json!(unknown)),
            ("shortfallTokens", json!(shortfall)),
            ("cacheLifetimeSeconds", json!(lifetime_ms / 1000)),
            (
                "calls",
                json!(largest
                    .iter()
                    .take(CALL_LIMIT)
                    .map(|miss| json!({
                        "call": miss.call,
                        "shortfallTokens": miss.shortfall,
                        "cause": miss.cause,
                        "pauseSeconds": miss.pause_ms.map(|pause| pause / 1000),
                    }))
                    .collect::<Vec<_>>()),
            ),
        ]),
    })
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
            ("averageContextRecordedCalls", json!(facts.average_context_recorded_calls)),
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
                && !super::build::inherited(item)
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

/// Large tool results identical to an earlier result that was still in context when they
/// were first sent, grouped by the tool and command that returned them again.
fn repeated_results_in_context(
    analysis: &Analysis,
    runs: &[ToolRun],
    thresholds: &Thresholds,
    limit: usize,
) -> Vec<Finding> {
    let presence: HashMap<&str, &[Range]> = analysis
        .context_items
        .iter()
        .map(|item| (item.id.as_str(), item.presence.as_slice()))
        .collect();
    let in_context = |run: &ToolRun, call: usize| {
        presence.get(run.item_id.as_str()).is_some_and(|ranges| {
            ranges
                .iter()
                .any(|range| range.start_call <= call && call <= range.end_call)
        })
    };
    let mut ordered: Vec<&ToolRun> = runs.iter().collect();
    ordered.sort_by_key(|run| run.first_call);
    // Each repeat with the earliest identical result still in context.
    let mut earlier: HashMap<blake3::Hash, Vec<&ToolRun>> = HashMap::new();
    let mut repeats: Vec<(&ToolRun, &ToolRun)> = Vec::new();
    for run in ordered {
        let Some(hash) = run.result_hash else {
            continue;
        };
        let copies = earlier.entry(hash).or_default();
        if run.tokens.unwrap_or(0) >= thresholds.repeated_result_tokens {
            if let Some(copy) = copies.iter().find(|copy| in_context(copy, run.first_call)) {
                repeats.push((run, copy));
            }
        }
        copies.push(run);
    }
    let mut groups: Vec<Vec<(&ToolRun, &ToolRun)>> = Vec::new();
    let mut positions: HashMap<(&str, &str), usize> = HashMap::new();
    for (run, copy) in repeats {
        let key = (run.tool.as_str(), run.command.as_str());
        let position = *positions.entry(key).or_insert_with(|| {
            groups.push(Vec::new());
            groups.len() - 1
        });
        groups[position].push((run, copy));
    }
    let mut findings: Vec<Finding> = groups
        .into_iter()
        .map(|group| {
            let (first, first_copy) = group[0];
            let result_tokens: u64 = group.iter().map(|(run, _)| run.tokens.unwrap_or(0)).sum();
            let runs: Vec<&ToolRun> = group.iter().map(|(run, _)| *run).collect();
            Finding {
                pattern: "repeatedResultInContext",
                basis: "estimated",
                estimated_cost: total_cost(&runs),
                summary: format!(
                    "{} returned the same result {} while an earlier copy was in context ({} tokens)",
                    describe_run(first),
                    more_times(group.len()),
                    grouped(result_tokens)
                ),
                items: runs.iter().take(ITEM_LIMIT).map(|run| run.item(false)).collect(),
                facts: BTreeMap::from([
                    ("tool", json!(first.tool)),
                    ("command", json!(shorten(&first.command))),
                    ("repeats", json!(group.len())),
                    ("resultTokens", json!(result_tokens)),
                    (
                        "firstCall",
                        json!(group.iter().map(|(_, copy)| copy.first_call).min()),
                    ),
                    ("callsBetween", json!(first.first_call - first_copy.first_call)),
                    ("failed", json!(runs.iter().filter(|run| run.failed).count())),
                ]),
            }
        })
        .collect();
    rank(&mut findings, limit);
    findings
}

/// Search tools, by name in lower case, whose results can be long.
const SEARCH_TOOLS: [&str; 5] = ["grep", "glob", "find", "grep_search", "file_search"];

/// Arguments that limit a search tool's results.
const SEARCH_LIMITS: [&str; 4] = ["head_limit", "limit", "maxResults", "max_results"];

/// What a large result with no limit on its output is grouped by: the shell command's family,
/// or the search tool's name. `None` when the run limited its output, or is not a shell
/// command or search tool that could have. Shell commands that run several commands in turn
/// are left out, since their output cannot be divided between them.
fn unlimited_family(run: &ToolRun, thresholds: &Thresholds) -> Option<String> {
    if run.tokens.unwrap_or(0) < thresholds.unlimited_output_tokens {
        return None;
    }
    if let Some(family) = &run.family {
        let list = ["&&", "||", ";", "\n"]
            .iter()
            .any(|separator| run.command.trim().contains(separator));
        return (LIMITABLE_FAMILIES.contains(&family.as_str())
            && !list
            && !has_output_limit(family, &run.command))
        .then(|| family.clone());
    }
    if !SEARCH_TOOLS.contains(&run.tool.to_lowercase().as_str()) {
        return None;
    }
    let arguments: Value = serde_json::from_str(&run.command).unwrap_or(Value::Null);
    let given = |key: &str| arguments.get(key).is_some_and(|value| !value.is_null());
    // Claude Code's Grep lists matching files unless asked for the lines.
    let lists_files = run.tool == "Grep"
        && arguments.get("output_mode").and_then(Value::as_str) != Some("content");
    (!lists_files && !SEARCH_LIMITS.iter().any(|key| given(key))).then(|| run.tool.clone())
}

/// Runs of one family that returned large results without limiting their output, whichever
/// shell tool ran them.
fn unlimited_groups<'a>(
    runs: impl IntoIterator<Item = &'a ToolRun>,
    thresholds: &Thresholds,
) -> Vec<(String, Vec<&'a ToolRun>)> {
    let mut groups: Vec<(String, Vec<&ToolRun>)> = Vec::new();
    let mut positions: HashMap<String, usize> = HashMap::new();
    for run in runs {
        let Some(family) = unlimited_family(run, thresholds) else {
            continue;
        };
        let position = *positions.entry(family.clone()).or_insert_with(|| {
            groups.push((family, Vec::new()));
            groups.len() - 1
        });
        groups[position].1.push(run);
    }
    groups
}

/// The facts both forms of `largeUnlimitedOutput` share, with up to three of the commands,
/// largest result first.
fn unlimited_facts(family: &str, runs: &[&ToolRun]) -> BTreeMap<&'static str, Value> {
    let mut largest: Vec<&&ToolRun> = runs.iter().collect();
    largest.sort_by_key(|run| std::cmp::Reverse(run.tokens.unwrap_or(0)));
    let mut commands: Vec<String> = Vec::new();
    for run in largest {
        let command = shorten(&run.command);
        if commands.len() < ITEM_LIMIT && !commands.contains(&command) {
            commands.push(command);
        }
    }
    BTreeMap::from([
        (
            "tools",
            json!(super::distinct(runs.iter().map(|run| run.tool.as_str()))),
        ),
        ("family", json!(family)),
        ("runs", json!(runs.len())),
        (
            "resultTokens",
            json!(runs.iter().map(|run| run.tokens.unwrap_or(0)).sum::<u64>()),
        ),
        (
            "largestResultTokens",
            json!(runs.iter().map(|run| run.tokens.unwrap_or(0)).max()),
        ),
        ("commands", json!(commands)),
    ])
}

/// Large results from shell commands and searches that did not limit their output.
fn large_unlimited_outputs(
    runs: &[ToolRun],
    thresholds: &Thresholds,
    limit: usize,
) -> Vec<Finding> {
    let mut findings: Vec<Finding> = unlimited_groups(runs, thresholds)
        .into_iter()
        .map(|(family, runs)| {
            let result_tokens: u64 = runs.iter().map(|run| run.tokens.unwrap_or(0)).sum();
            Finding {
                pattern: "largeUnlimitedOutput",
                basis: "estimated",
                estimated_cost: total_cost(&runs),
                summary: format!(
                    "`{family}` returned {} without limiting its output ({} tokens)",
                    plural(runs.len(), "large result"),
                    grouped(result_tokens)
                ),
                items: runs
                    .iter()
                    .take(ITEM_LIMIT)
                    .map(|run| run.item(false))
                    .collect(),
                facts: unlimited_facts(&family, &runs),
            }
        })
        .collect();
    rank(&mut findings, limit);
    findings
}

/// Shell commands and searches that returned large results without limiting their output
/// in several of the reported sessions.
fn large_unlimited_outputs_across(
    runs: &[ToolRun],
    thresholds: &Thresholds,
    limit: usize,
) -> Vec<Finding> {
    let mut findings: Vec<Finding> = unlimited_groups(runs, thresholds)
        .into_iter()
        .filter_map(|(family, runs)| {
            let sessions: Vec<&str> =
                super::distinct(runs.iter().map(|run| run.reference.as_str()));
            if sessions.len() < thresholds.repeated_sessions {
                return None;
            }
            let result_tokens: u64 = runs.iter().map(|run| run.tokens.unwrap_or(0)).sum();
            let mut examples = Vec::new();
            let mut listed = HashSet::new();
            for run in &runs {
                if examples.len() < ITEM_LIMIT && listed.insert(run.reference.as_str()) {
                    examples.push(run.item(true));
                }
            }
            let mut facts = unlimited_facts(&family, &runs);
            facts.insert("sessions", json!(sessions.len()));
            Some(Finding {
                pattern: "largeUnlimitedOutput",
                basis: "estimated",
                estimated_cost: total_cost(&runs),
                summary: format!(
                    "`{family}` returned {} without limiting its output in {} sessions ({} tokens)",
                    plural(runs.len(), "large result"),
                    sessions.len(),
                    grouped(result_tokens)
                ),
                items: examples,
                facts,
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
    findings.extend(large_unlimited_outputs_across(&runs, thresholds, limit));
    findings.extend(fixed_overheads(reports, thresholds));
    findings
}

/// Parts listed for a `fixedOverhead` finding.
const PART_LIMIT: usize = 8;

/// One part of the fixed overhead over a harness's sessions.
#[derive(Default)]
struct PartTotal<'a> {
    kind: &'a str,
    label: &'a str,
    /// The part's tokens in each session it was in: the largest, when it was sent again.
    tokens: Vec<u64>,
    cost: FindingCost,
    used_in: usize,
    /// The most expensive single item, with its session.
    example: Option<(f64, &'a str, &'a str)>,
}

fn median(values: &mut [u64]) -> Option<u64> {
    values.sort_unstable();
    values.get(values.len() / 2).copied()
}

/// For each harness with several sessions, what its sessions sent before any work and what
/// that cost.
fn fixed_overheads(reports: &[SessionReport], thresholds: &Thresholds) -> Vec<Finding> {
    let mut harnesses: BTreeMap<&str, Vec<&SessionReport>> = BTreeMap::new();
    for report in reports {
        harnesses.entry(&report.harness).or_default().push(report);
    }
    let mut findings: Vec<Finding> = harnesses
        .into_iter()
        .filter(|(_, sessions)| sessions.len() >= thresholds.repeated_sessions)
        .filter_map(|(harness, sessions)| {
            let mut parts: Vec<PartTotal<'_>> = Vec::new();
            let mut positions: HashMap<(&str, &str), usize> = HashMap::new();
            let mut cost = FindingCost::default();
            for session in &sessions {
                let tools: HashSet<&str> =
                    session.runs.iter().map(|run| run.tool.as_str()).collect();
                let mut in_session: HashMap<usize, u64> = HashMap::new();
                for part in &session.fixed.parts {
                    cost.add(part.cost);
                    let position = *positions
                        .entry((&part.kind, &part.label))
                        .or_insert_with(|| {
                            parts.push(PartTotal {
                                kind: &part.kind,
                                label: &part.label,
                                ..PartTotal::default()
                            });
                            parts.len() - 1
                        });
                    let total = &mut parts[position];
                    total.cost.add(part.cost);
                    let usd = part.cost.rank();
                    if total.example.is_none_or(|(largest, _, _)| usd > largest) {
                        total.example = Some((usd, &session.reference, &part.item_id));
                    }
                    let tokens = in_session.entry(position).or_default();
                    *tokens = (*tokens).max(part.tokens);
                }
                for (position, tokens) in in_session {
                    let total = &mut parts[position];
                    total.tokens.push(tokens);
                    let short = total.label.rsplit('.').next().unwrap_or(total.label);
                    if total.kind == "toolDefinition"
                        && (tools.contains(total.label) || tools.contains(short))
                    {
                        total.used_in += 1;
                    }
                }
            }
            if parts.is_empty() {
                return None;
            }
            parts.sort_by(|a, b| b.cost.rank().total_cmp(&a.cost.rank()));
            let mut first_calls: Vec<u64> = sessions
                .iter()
                .filter_map(|session| session.fixed.first_call_tokens)
                .collect();
            let largest_first_call = first_calls.iter().max().copied();
            let median_first_call = median(&mut first_calls);
            let total = |amounts: &mut dyn Iterator<Item = Option<f64>>| {
                amounts.flatten().fold(None, |sum: Option<f64>, usd| {
                    Some(sum.unwrap_or(0.0) + usd)
                })
            };
            let input = total(&mut sessions.iter().map(|session| session.fixed.input_usd));
            let output = total(&mut sessions.iter().map(|session| session.fixed.output_usd));
            let share = |whole: Option<f64>| {
                cost.usd
                    .zip(whole)
                    .filter(|(_, whole)| *whole > 0.0)
                    .map(|(part, whole)| (part / whole * 1000.0).round() / 1000.0)
            };
            let share_of_input = share(input);
            let share_of_cost = share(input.map(|input| input + output.unwrap_or(0.0)));
            let percent = |share: Option<f64>, of: &str| {
                share.map(|share| format!("{:.1}% of {of}", share * 100.0))
            };
            let shares: Vec<String> = [
                percent(share_of_input, "input"),
                percent(share_of_cost, "all cost"),
            ]
            .into_iter()
            .flatten()
            .collect();
            let amount = |cost: FindingCost| {
                cost.usd.map_or_else(
                    || format!("{} token-turns", grouped(cost.token_turns)),
                    |usd| format!("${usd:.2}"),
                )
            };
            let largest: Vec<String> = parts
                .iter()
                .take(ITEM_LIMIT)
                .map(|part| format!("{} ({})", part.label, amount(part.cost)))
                .collect();
            let start = median_first_call.map_or_else(
                || format!("{harness} sessions' fixed overhead"),
                |tokens| {
                    format!(
                        "{harness} sessions start with a median of {} tokens before any work; this part",
                        grouped(tokens)
                    )
                },
            );
            Some(Finding {
                pattern: "fixedOverhead",
                basis: "estimated",
                estimated_cost: cost,
                summary: format!(
                    "{start} cost {}{} over {} sessions. Largest: {}",
                    amount(cost),
                    if shares.is_empty() {
                        String::new()
                    } else {
                        format!(" ({})", shares.join(", "))
                    },
                    sessions.len(),
                    largest.join(", ")
                ),
                items: parts
                    .iter()
                    .take(ITEM_LIMIT)
                    .filter_map(|part| part.example)
                    .map(|(_, reference, item_id)| ItemRef {
                        reference: Some(reference.to_owned()),
                        item_id: item_id.to_owned(),
                    })
                    .collect(),
                facts: BTreeMap::from([
                    ("harness", json!(harness)),
                    ("sessions", json!(sessions.len())),
                    ("medianFirstCallTokens", json!(median_first_call)),
                    ("largestFirstCallTokens", json!(largest_first_call)),
                    ("shareOfInput", json!(share_of_input)),
                    ("shareOfCost", json!(share_of_cost)),
                    (
                        "parts",
                        json!(parts
                            .iter_mut()
                            .take(PART_LIMIT)
                            .map(|part| {
                                let mut fact = json!({
                                    "kind": part.kind,
                                    "label": part.label,
                                    "sessions": part.tokens.len(),
                                    "medianTokens": median(&mut part.tokens),
                                    "estimatedCost": part.cost,
                                });
                                if part.kind == "toolDefinition" {
                                    fact["usedInSessions"] = json!(part.used_in);
                                }
                                fact
                            })
                            .collect::<Vec<_>>()),
                    ),
                ]),
            })
        })
        .collect();
    rank(&mut findings, usize::MAX);
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

/// The run's tool and command, or the tool alone when there is no command.
fn describe_run(run: &ToolRun) -> String {
    if run.command.is_empty() {
        run.tool.clone()
    } else {
        describe(&run.tool, &run.command)
    }
}

/// "again" or "3 more times".
fn more_times(count: usize) -> String {
    if count == 1 {
        "again".to_owned()
    } else {
        format!("{count} more times")
    }
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
pub(super) fn fixed_overheads_for_test(
    reports: &[SessionReport],
    thresholds: &Thresholds,
) -> Vec<Finding> {
    fixed_overheads(reports, thresholds)
}

#[cfg(test)]
pub(super) fn reruns_for_test(
    analysis: &Analysis,
    runs: &[ToolRun],
    thresholds: &Thresholds,
) -> Option<Finding> {
    reruns_after_compactions(analysis, runs, thresholds)
}

#[cfg(test)]
pub(super) fn cache_misses_for_test(
    analysis: &Analysis,
    prices: &[Option<InputPrice>],
    thresholds: &Thresholds,
) -> Option<Finding> {
    cache_misses(analysis, prices, thresholds)
}

#[cfg(test)]
pub(super) fn comparable_for_test(previous: &ModelCall, call: &ModelCall) -> bool {
    comparable(previous, call)
}

#[cfg(test)]
pub(super) fn unlimited_outputs_for_test(
    runs: &[ToolRun],
    thresholds: &Thresholds,
) -> Vec<Finding> {
    large_unlimited_outputs(runs, thresholds, usize::MAX)
}

#[cfg(test)]
pub(super) fn repeated_results_for_test(
    analysis: &Analysis,
    runs: &[ToolRun],
    thresholds: &Thresholds,
) -> Vec<Finding> {
    repeated_results_in_context(analysis, runs, thresholds, usize::MAX)
}
