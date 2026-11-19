//! One session's report: totals from the analysis, each item's cost over its lifetime, and
//! the tool runs that findings are made from.

use super::{
    distinct, findings,
    types::{
        CarriedContext, CompactionCalls, FamilyTotal, FindingCost, FixedOverhead, FixedPart,
        KindTotal, Reconstruction, SessionCost, SessionReport, Thresholds, TokenStats, TokenTotals,
        TokenTotalsCoverage, ToolRun, ToolTotal, UsdRange,
    },
};
use crate::{
    analysis::reported_token_subtotals,
    api::{Analysis, ContextItem, CostSubtotal, ModelCall},
    domain::{AssistantContentBlock, NormalizedSession, TokenizationPayload},
    pricing::{self, CallToPrice, InputPrice},
    server::SessionFile,
};
use serde_json::Value;
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    path::Path,
};

/// An item's size and what it cost over every call it was sent with.
#[derive(Debug, Clone, Copy, Default)]
pub(super) struct ItemCost {
    /// At the item's first call.
    pub tokens: Option<u64>,
    pub first_call: usize,
    pub present_calls: usize,
    pub cost: FindingCost,
    /// The part of `cost` at calls three or more user turns after the item was added, for
    /// the conversation's own items (messages, tool results and thinking).
    pub carried: FindingCost,
}

/// How many user turns old an item must be to count as carried context.
pub(super) const CARRIED_AFTER_TURNS: usize = 3;

/// The item kinds that make up the conversation itself, as opposed to the system prompt,
/// tool definitions, attachments, summaries and measured context sent with every call.
const CONVERSATION_KINDS: [&str; 4] = ["userMessage", "assistantMessage", "toolResult", "thinking"];

/// Whether a fork copied the item from its parent session. Those items are context for the
/// fork's calls, but the parent's report covers the turns and tool runs they came from.
pub(super) fn inherited(item: &ContextItem) -> bool {
    item.metadata.get("inherited").map(String::as_str) == Some("true")
}

/// The user turn each call belongs to, by position (call `n` at `n - 1`): the number of
/// user messages added at or before it, not counting those a fork copied from its parent.
pub(super) fn user_turns(analysis: &Analysis) -> Vec<usize> {
    let mut starts: Vec<usize> = analysis
        .context_items
        .iter()
        .filter(|item| item.kind == "userMessage" && !inherited(item))
        .filter_map(|item| item.presence.first().map(|range| range.start_call))
        .collect();
    starts.sort_unstable();
    (1..=analysis.model_calls.len())
        .map(|call| starts.partition_point(|start| *start <= call))
        .collect()
}

pub(super) fn session_report(
    session: &SessionFile,
    normalized: &NormalizedSession,
    analysis: &Analysis,
    thresholds: &Thresholds,
    limit: usize,
) -> SessionReport {
    let costs = item_costs(analysis, normalized);
    let runs = tool_runs(session, normalized, analysis, &costs);
    let summary = &analysis.session;
    let tokens = token_totals(normalized);
    let calls = analysis.model_calls.len();
    let average_context_tokens = tokens
        .prompt
        .and_then(|total| total.checked_div(tokens.coverage.prompt.recorded_calls as u64));
    let turns = user_turns(analysis).last().copied().unwrap_or(0);
    let carried = carried_context(&costs);
    let prices = call_prices(analysis, normalized);
    let fixed = fixed_overhead(analysis, &costs, &prices);
    let findings = findings::session_findings(
        &findings::SessionFacts {
            analysis,
            prices: &prices,
            costs: &costs,
            runs: &runs,
            carried: &carried,
            turns,
            average_context_tokens,
            average_context_recorded_calls: tokens.coverage.prompt.recorded_calls,
        },
        thresholds,
        limit,
    );
    SessionReport {
        reference: session.id.clone(),
        harness: session.harness.clone(),
        title: session.display_name.clone(),
        working_directory: session.working_directory.clone(),
        parent: session.parent_reference.clone(),
        started_at: session.started_at.map(|at| at.to_rfc3339()),
        updated_at: session.modified_at.map(|at| at.to_rfc3339()),
        models: distinct(
            analysis
                .model_calls
                .iter()
                .filter_map(|call| call.model.clone())
                // Claude Code's model name for messages it wrote itself, such as an error.
                .filter(|model| model != "<synthetic>"),
        ),
        calls,
        average_context_tokens,
        tokens,
        cost: SessionCost {
            billed: usd_range(&summary.cost_summary.billed),
            api_equivalent: usd_range(&summary.cost_summary.api_equivalent),
            unknown_calls: summary.cost_summary.unknown_calls,
        },
        reconstruction: Reconstruction {
            median_absolute_gap_percent: summary.median_absolute_residual_percent,
            limitation_codes: analysis
                .reconstruction
                .as_ref()
                .map(|coverage| coverage.explanation_codes.clone())
                .unwrap_or_default(),
        },
        peak_context_tokens: summary.peak_calculated_visible_tokens,
        compactions: analysis.compactions.len(),
        compaction_calls: compaction_calls(analysis),
        user_turns: turns,
        carried_context: carried,
        context_by_kind: context_by_kind(analysis, &costs),
        tools: tool_totals(analysis, &costs, &runs),
        command_families: family_totals(&runs, FAMILY_LIMIT),
        child_sessions: Vec::new(),
        findings,
        runs,
        fixed,
    }
}

fn usd_range(subtotal: &CostSubtotal) -> Option<UsdRange> {
    let low = subtotal.low?;
    Some(UsdRange {
        low,
        high: subtotal.high.unwrap_or(low),
    })
}

pub(super) fn token_totals(session: &NormalizedSession) -> TokenTotals {
    let subtotals = reported_token_subtotals(&session.model_calls);
    TokenTotals {
        prompt: subtotals.prompt.value,
        fresh_input: subtotals.fresh_input.value,
        cache_read: subtotals.cache_read.value,
        cache_write: subtotals.cache_write.value,
        output: subtotals.output.value,
        reasoning: subtotals.reasoning.value,
        coverage: TokenTotalsCoverage {
            prompt: subtotals.prompt.coverage,
            fresh_input: subtotals.fresh_input.coverage,
            cache_read: subtotals.cache_read.coverage,
            cache_write: subtotals.cache_write.coverage,
            output: subtotals.output.coverage,
            reasoning: subtotals.reasoning.coverage,
        },
    }
}

/// The item's tokens under the call's tokenization profile, or its first estimate.
fn tokens_at(item: &ContextItem, profile: Option<&str>) -> Option<u64> {
    profile
        .and_then(|profile| {
            item.token_estimates
                .iter()
                .find(|estimate| estimate.profile_id == profile)
        })
        .or_else(|| item.token_estimates.first())
        .and_then(|estimate| estimate.tokens)
}

/// Each call's input prices, in call order.
pub(super) fn call_prices(
    analysis: &Analysis,
    normalized: &NormalizedSession,
) -> Vec<Option<InputPrice>> {
    let table = pricing::embedded();
    let harness = analysis.session.source.as_str();
    analysis
        .model_calls
        .iter()
        .zip(&normalized.model_calls)
        .map(|(call, source)| {
            pricing::input_price(
                table,
                CallToPrice {
                    harness,
                    provider: call.provider.as_deref(),
                    model: call.model.as_deref(),
                    at_ms: call.timing.recorded_at_ms.or(call.timing.started_at_ms),
                    usage: &source.reported_usage,
                },
            )
        })
        .collect()
}

/// Each item's cost over its lifetime. Within a call, an item sent for the first time in a
/// stretch is priced as a cache write (or uncached input) and the others as cache reads;
/// those amounts are then scaled so the call's items add up to the call's reported input
/// cost, which takes in cache misses and rewrites the simple model leaves out.
pub(super) fn item_costs(analysis: &Analysis, normalized: &NormalizedSession) -> Vec<ItemCost> {
    let calls: Vec<(Option<&str>, Option<InputPrice>)> = analysis
        .model_calls
        .iter()
        .zip(call_prices(analysis, normalized))
        .map(|(call, price)| (call.tokenization_profile_id.as_deref(), price))
        .collect();
    // Each item's tokens and simple-model cost at every call it is present for.
    let mut shares: Vec<Vec<(usize, u64, Option<f64>)>> = Vec::new();
    let mut modelled = vec![0.0; calls.len()];
    for item in &analysis.context_items {
        let mut item_shares = Vec::new();
        for range in &item.presence {
            for call in range.start_call..=range.end_call {
                let Some((profile, price)) = call.checked_sub(1).and_then(|i| calls.get(i)) else {
                    continue;
                };
                let tokens = tokens_at(item, *profile);
                let cost = price.zip(tokens).map(|(price, tokens)| {
                    let rate = if call == range.start_call {
                        price.cache_write
                    } else {
                        price.cache_read
                    };
                    tokens as f64 * rate
                });
                modelled[call - 1] += cost.unwrap_or(0.0);
                item_shares.push((call, tokens.unwrap_or(0), cost));
            }
        }
        shares.push(item_shares);
    }
    let scale: Vec<f64> = calls
        .iter()
        .zip(&modelled)
        .map(
            |((_, price), modelled)| match price.and_then(|price| price.prompt_cost) {
                Some(actual) if *modelled > 0.0 => actual / modelled,
                _ => 1.0,
            },
        )
        .collect();
    let turns = user_turns(analysis);
    let turn_at = |call: usize| call.checked_sub(1).and_then(|i| turns.get(i)).copied();
    analysis
        .context_items
        .iter()
        .zip(shares)
        .map(|(item, item_shares)| {
            let first_call = item.presence.first().map_or(0, |range| range.start_call);
            // Items a fork copied from its parent were added before its first turn.
            let added_turn = (if inherited(item) {
                Some(0)
            } else {
                turn_at(first_call)
            })
            .filter(|_| CONVERSATION_KINDS.contains(&item.kind.as_str()));
            let mut cost = ItemCost {
                first_call,
                present_calls: item_shares.len(),
                ..ItemCost::default()
            };
            for (call, tokens, usd) in item_shares {
                if cost.tokens.is_none() && tokens > 0 {
                    cost.tokens = Some(tokens);
                }
                let share = FindingCost {
                    usd: usd.map(|usd| usd * scale[call - 1]),
                    token_turns: tokens,
                };
                cost.cost.add(share);
                let carried = added_turn
                    .zip(turn_at(call))
                    .is_some_and(|(added, now)| now >= added + CARRIED_AFTER_TURNS);
                if carried {
                    cost.carried.add(share);
                }
            }
            cost
        })
        .collect()
}

/// Every tool result, joined to the call that asked for it, except those a fork copied from
/// its parent.
fn tool_runs(
    session: &SessionFile,
    normalized: &NormalizedSession,
    analysis: &Analysis,
    costs: &[ItemCost],
) -> Vec<ToolRun> {
    let mut arguments: HashMap<&str, &str> = HashMap::new();
    for item in &normalized.context_items {
        if let TokenizationPayload::AssistantMessage { blocks, .. } = &item.payload {
            for block in blocks {
                if let AssistantContentBlock::ToolCall {
                    id,
                    arguments: text,
                    ..
                } = block
                {
                    arguments.insert(id, text);
                }
            }
        }
    }
    let paths = Paths::for_directory(session.working_directory.as_deref());
    let payloads: HashMap<&str, &TokenizationPayload> = normalized
        .context_items
        .iter()
        .map(|item| (item.id.as_str(), &item.payload))
        .collect();
    analysis
        .context_items
        .iter()
        .zip(costs)
        .filter(|(item, _)| item.kind == "toolResult" && !inherited(item))
        .filter_map(|(item, cost)| {
            let payload = payloads.get(item.id.as_str())?;
            let TokenizationPayload::ToolResult {
                tool_call_id,
                tool_name,
                is_error,
                ..
            } = payload
            else {
                return None;
            };
            let text = arguments.get(tool_call_id.as_str());
            let command =
                text.map_or_else(String::new, |text| command_key(tool_name, text, &paths));
            let shell = text
                .and_then(|text| serde_json::from_str::<Value>(text).ok())
                .is_some_and(|value| shell_command(&value).is_some());
            Some(ToolRun {
                tool: tool_name.clone(),
                family: shell.then(|| command_family(&command)),
                command,
                first_call: cost.first_call,
                failed: *is_error,
                result_hash: crate::analysis::tool_result_hash(payload),
                cost: cost.cost,
                reference: session.id.clone(),
                item_id: item.id.clone(),
                tokens: cost.tokens,
            })
        })
        .collect()
}

/// What makes two runs of a tool the same: a shell tool's command, without a leading
/// change of directory; the path a read tool read, whatever part of it; or otherwise the
/// arguments as canonical JSON without null values, or the text itself when it is not JSON.
/// Paths in the session's working tree are written relative to its top folder.
pub(super) fn command_key(tool: &str, arguments: &str, paths: &Paths) -> String {
    let Ok(mut value) = serde_json::from_str::<Value>(arguments) else {
        return paths.in_text(arguments.trim());
    };
    if let Some(command) = shell_command(&value) {
        return paths.in_text(without_cd(&command));
    }
    if tool.to_lowercase().contains("read") {
        if let Some(path) = ["file_path", "filePath", "path"]
            .iter()
            .find_map(|key| value.get(key).and_then(Value::as_str))
        {
            return paths.relative(path);
        }
    }
    if let Value::Object(fields) = &mut value {
        fields.retain(|_, field| !field.is_null());
    }
    paths.in_text(&value.to_string())
}

/// A shell tool's command: its `command` or `cmd` argument, as a string or a list of words.
fn shell_command(arguments: &Value) -> Option<String> {
    match ["command", "cmd"]
        .iter()
        .find_map(|key| arguments.get(key))?
    {
        Value::String(text) => Some(text.trim().to_owned()),
        Value::Array(parts) => Some(
            parts
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join(" "),
        ),
        _ => None,
    }
}

/// Programs whose first argument names what they do, so it is part of the family.
const SUBCOMMAND_PROGRAMS: [&str; 26] = [
    "aws",
    "az",
    "brew",
    "bun",
    "cargo",
    "docker",
    "dotnet",
    "gcloud",
    "gh",
    "git",
    "go",
    "highwater",
    "just",
    "kubectl",
    "make",
    "nix",
    "npm",
    "npx",
    "pip",
    "pip3",
    "pnpm",
    "terraform",
    "treehouse",
    "uv",
    "yarn",
    "pwsh",
];

/// Options that take a value in the next word and can come before a subcommand, as in
/// `git -C <dir> status` and `npm --prefix <dir> run test`.
const VALUE_OPTIONS: [&str; 10] = [
    "-C",
    "-c",
    "-R",
    "--repo",
    "--prefix",
    "--dir",
    "--cwd",
    "--manifest-path",
    "--git-dir",
    "--work-tree",
];

/// What a shell command runs, for totals by family: the first program, with its subcommand
/// for programs that have them (`git status`, `cargo test`), and after a `run` subcommand
/// what it runs (`npm run build`, `gh run view`). Variable assignments and `sudo`, `env`,
/// `time`, `nice` and `exec` before the program are skipped, and a program given by an
/// absolute path is named by its file name.
pub(super) fn command_family(command: &str) -> String {
    let mut words = command
        .split_whitespace()
        .map(|word| word.trim_start_matches('(').trim_matches(['\'', '"']))
        .skip_while(|word| {
            word.contains('=') || ["sudo", "env", "time", "nice", "exec"].contains(word)
        });
    let Some(program) = words.next() else {
        return String::new();
    };
    let program = if program.starts_with('/') {
        program.rsplit('/').next().unwrap_or(program)
    } else {
        program
    };
    let mut family = program.to_owned();
    if SUBCOMMAND_PROGRAMS.contains(&program) {
        // Options before the subcommand, with the value of those that take one.
        let mut skip_value = false;
        let mut words = words.filter(|word| {
            let value = std::mem::replace(&mut skip_value, VALUE_OPTIONS.contains(word));
            !value && !word.starts_with('-')
        });
        let word_like = |word: &&str| {
            word.chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == ':')
        };
        if let Some(subcommand) = words.next().filter(word_like) {
            family.push(' ');
            family.push_str(subcommand);
            if subcommand == "run" {
                if let Some(script) = words.next().filter(word_like) {
                    family.push(' ');
                    family.push_str(script);
                }
            }
        }
    }
    family
}

/// Shell command families whose output can be long and can be shortened from the command
/// line. Test runners and builds are left out: their output is hard to shorten that way.
pub(super) const LIMITABLE_FAMILIES: [&str; 9] = [
    "cat", "git diff", "git show", "git log", "grep", "rg", "find", "ls", "tree",
];

/// Programs that shorten what is piped into them.
const LIMITING_PROGRAMS: [&str; 10] = [
    "head", "tail", "grep", "rg", "jq", "wc", "cut", "sed", "awk", "less",
];

/// Whether a shell command limits its output: by piping it into a program that shortens it,
/// or with an option that does, such as `git diff --stat`, `git log -n 5` or `rg -l`.
pub(super) fn has_output_limit(family: &str, command: &str) -> bool {
    // A pipe, but not the second half of `||`.
    let mut after_or = false;
    for part in command.split('|').skip(1) {
        if part.is_empty() {
            after_or = true;
            continue;
        }
        if !after_or && LIMITING_PROGRAMS.contains(&command_family(part).as_str()) {
            return true;
        }
        after_or = false;
    }
    let first = command.split(['|', ';', '&']).next().unwrap_or_default();
    let mut words = first.split_whitespace();
    match family {
        "git diff" | "git show" => words.any(|word| {
            [
                "--stat",
                "--name-only",
                "--name-status",
                "--shortstat",
                "--numstat",
                "--no-patch",
                "-s",
                "--quiet",
            ]
            .iter()
            .any(|option| word == *option || word.starts_with(&format!("{option}=")))
        }),
        "git log" => words.any(|word| {
            word == "-n"
                || word.starts_with("--max-count")
                || word
                    .strip_prefix("-n")
                    .or_else(|| word.strip_prefix('-'))
                    .is_some_and(|count| !count.is_empty() && count.parse::<u32>().is_ok())
        }),
        "grep" | "rg" => words.any(|word| {
            if let Some(long) = word.strip_prefix("--") {
                return [
                    "files-with-matches",
                    "files-without-match",
                    "count",
                    "count-matches",
                    "max-count",
                    "quiet",
                ]
                .iter()
                .any(|option| long == *option || long.starts_with(&format!("{option}=")));
            }
            // Short options together, as in `-rl`, up to one that takes a value.
            word.strip_prefix('-').is_some_and(|options| {
                for option in options.chars() {
                    if matches!(option, 'l' | 'L' | 'c' | 'm' | 'q') {
                        return true;
                    }
                    if "efgtTABCdDEjM".contains(option) {
                        return false;
                    }
                }
                false
            })
        }),
        _ => false,
    }
}

/// The top folder of a session's working tree, for writing its paths relatively, so that
/// the same file in two worktrees of a repository compares equal.
pub(super) struct Paths {
    /// The top folder, or the working directory when it is not in a git working tree or no
    /// longer exists.
    root: Option<String>,
    /// The working directory relative to the top folder, ending in `/`, or empty.
    within: String,
}

impl Paths {
    pub(super) fn for_directory(working_directory: Option<&str>) -> Self {
        let Some(directory) = working_directory
            .map(|dir| dir.trim_end_matches(['/', '\\']))
            .filter(|dir| !dir.is_empty())
        else {
            return Self::none();
        };
        let root = super::repository::worktree_root(Path::new(directory))
            .map(|root| root.to_string_lossy().into_owned())
            .filter(|root| directory.starts_with(root.as_str()))
            .unwrap_or_else(|| directory.to_owned());
        let within = directory[root.len()..].trim_start_matches(['/', '\\']);
        Self {
            within: if within.is_empty() {
                String::new()
            } else {
                format!("{within}/")
            },
            root: Some(root),
        }
    }

    pub(super) fn none() -> Self {
        Self {
            root: None,
            within: String::new(),
        }
    }

    /// A path argument: relative to the top folder when it is inside it.
    fn relative(&self, path: &str) -> String {
        let Some(root) = &self.root else {
            return path.to_owned();
        };
        match path.strip_prefix(root.as_str()) {
            Some(rest) if rest.starts_with(['/', '\\']) => rest[1..].to_owned(),
            Some("") => ".".to_owned(),
            _ if Path::new(path).has_root() || path.starts_with('~') => path.to_owned(),
            _ => format!("{}{path}", self.within),
        }
    }

    /// Text such as a command, with each path in the top folder written relative to it.
    /// The top folder followed by a letter (`/repo-old`) is a different folder and is kept.
    fn in_text(&self, text: &str) -> String {
        let Some(root) = self.root.as_deref().filter(|root| !root.is_empty()) else {
            return text.to_owned();
        };
        let mut out = String::with_capacity(text.len());
        let mut rest = text;
        while let Some(at) = rest.find(root) {
            out.push_str(&rest[..at]);
            let after = &rest[at + root.len()..];
            match after.chars().next() {
                Some('/' | '\\') => rest = &after[1..],
                None | Some(' ' | '\'' | '"' | ';' | '&' | '|' | ')' | '\n') => {
                    out.push('.');
                    rest = after;
                }
                Some(_) => {
                    out.push_str(root);
                    rest = after;
                }
            }
        }
        out.push_str(rest);
        out
    }
}

/// `cd <dir> && rest` or `cd <dir>; rest` as `rest`.
fn without_cd(command: &str) -> &str {
    let Some(rest) = command.strip_prefix("cd ") else {
        return command;
    };
    ["&&", ";"]
        .iter()
        .filter_map(|separator| rest.find(separator).map(|at| (at, separator.len())))
        .min()
        .map_or(command, |(at, length)| rest[at + length..].trim_start())
}

/// The kinds of item that made up at least 1% of the tokens sent, largest first.
fn context_by_kind(analysis: &Analysis, costs: &[ItemCost]) -> Vec<KindTotal> {
    let mut kinds: BTreeMap<&str, (usize, FindingCost)> = BTreeMap::new();
    for (item, cost) in analysis.context_items.iter().zip(costs) {
        let entry = kinds.entry(item.kind.as_str()).or_default();
        entry.0 += 1;
        entry.1.add(cost.cost);
    }
    let total: u64 = kinds.values().map(|(_, cost)| cost.token_turns).sum();
    let mut kinds: Vec<KindTotal> = kinds
        .into_iter()
        .filter(|(_, (_, cost))| total > 0 && cost.token_turns * 100 >= total)
        .map(|(kind, (items, cost))| KindTotal {
            kind: kind.to_owned(),
            items,
            token_turns: cost.token_turns,
            share: if total == 0 {
                0.0
            } else {
                cost.token_turns as f64 / total as f64
            },
            estimated_cost: cost.usd,
        })
        .collect();
    kinds.sort_by_key(|kind| std::cmp::Reverse(kind.token_turns));
    kinds
}

fn carried_context(costs: &[ItemCost]) -> CarriedContext {
    let mut all = FindingCost::default();
    let mut carried = FindingCost::default();
    for cost in costs {
        all.add(cost.cost);
        carried.add(cost.carried);
    }
    CarriedContext {
        older_than_turns: CARRIED_AFTER_TURNS,
        token_turns: carried.token_turns,
        estimated_cost: carried.usd,
        share: if all.token_turns == 0 {
            0.0
        } else {
            carried.token_turns as f64 / all.token_turns as f64
        },
    }
}

/// What the session sent before any work. An item counts when it was not copied from a
/// parent session and is:
///
/// - a system prompt or tool definition, or a later version of one
/// - unrecorded request context measured at the first call, at the first call after a
///   compaction, or at a change of model
/// - a harness message (`customMessage`) sent at the first call, or sent again after a
///   compaction with the label of one the compaction removed
///
/// These follow the viewer's rules for an item that takes the place of an earlier one
/// (`web/src/lib/analysis-ordering.ts`).
pub(super) fn fixed_overhead(
    analysis: &Analysis,
    costs: &[ItemCost],
    prices: &[Option<InputPrice>],
) -> FixedOverhead {
    let calls = &analysis.model_calls;
    let Some(first) = calls.first() else {
        return FixedOverhead::default();
    };
    let compactions: HashSet<usize> = analysis
        .compactions
        .iter()
        .map(|compaction| compaction.before_model_call)
        .collect();
    let model_changes: HashSet<usize> = calls
        .windows(2)
        .filter(|pair| pair[0].model != pair[1].model)
        .map(|pair| pair[1].index)
        .collect();
    let items: HashMap<&str, &ContextItem> = analysis
        .context_items
        .iter()
        .map(|item| (item.id.as_str(), item))
        .collect();
    // The labels of harness messages each compaction removed, by the call after it.
    let mut removed: HashMap<usize, HashSet<&str>> = HashMap::new();
    for compaction in &analysis.compactions {
        let retained: HashSet<&str> = compaction
            .retained_item_ids
            .iter()
            .map(String::as_str)
            .collect();
        removed
            .entry(compaction.before_model_call)
            .or_default()
            .extend(
                compaction
                    .source_item_ids
                    .iter()
                    .filter(|id| !retained.contains(id.as_str()))
                    .filter_map(|id| items.get(id.as_str()))
                    .filter(|item| item.kind == "customMessage")
                    .map(|item| item.label.as_str()),
            );
    }
    let counts = |item: &ContextItem| {
        let at = item.first_model_call;
        match item.kind.as_str() {
            "system" | "toolDefinition" => true,
            // A compaction call's input is the conversation it summarised, not overhead.
            "unrecordedContext" if item.metadata.contains_key("compactionInput") => false,
            "unrecordedContext" => {
                at == first.index || compactions.contains(&at) || model_changes.contains(&at)
            }
            "customMessage" => {
                at == first.index
                    || removed
                        .get(&at)
                        .is_some_and(|labels| labels.contains(item.label.as_str()))
            }
            _ => false,
        }
    };
    let parts = analysis
        .context_items
        .iter()
        .zip(costs)
        .filter(|(item, _)| !inherited(item) && !item.presence.is_empty() && counts(item))
        .map(|(item, cost)| FixedPart {
            kind: item.kind.clone(),
            label: part_label(item),
            tokens: cost.tokens.unwrap_or(0),
            cost: cost.cost,
            item_id: item.id.clone(),
        })
        .collect();
    let sum = |values: Vec<Option<f64>>| {
        values
            .iter()
            .any(Option::is_some)
            .then(|| values.iter().flatten().sum())
    };
    // A fork's first call also sends the history it copied from its parent.
    let forked = analysis.context_items.iter().any(inherited);
    FixedOverhead {
        first_call_tokens: first.economics.prompt_tokens.filter(|_| !forked),
        parts,
        input_usd: sum(costs.iter().map(|cost| cost.cost.usd).collect()),
        output_usd: sum(prices
            .iter()
            .map(|price| price.and_then(|price| price.output_cost))
            .collect()),
    }
}

/// A fixed item's name for grouping it with the same item in other sessions: a tool
/// definition's tool name, or the label without a measured token count.
fn part_label(item: &ContextItem) -> String {
    if item.kind == "toolDefinition" {
        if let Some(name) = item.metadata.get("toolName") {
            return name.clone();
        }
        if let Some(name) = item.label.strip_suffix(" definition") {
            return name.to_owned();
        }
    }
    if item.kind == "unrecordedContext" {
        if let Some((name, _)) = item.label.split_once(" · ") {
            return name.to_owned();
        }
    }
    item.label.clone()
}

/// Command families listed for each session.
const FAMILY_LIMIT: usize = 6;

/// Shell runs by family, most expensive first. `sessions` is counted when the runs come
/// from more than one session.
pub(super) fn family_totals<'a>(
    runs: impl IntoIterator<Item = &'a ToolRun>,
    limit: usize,
) -> Vec<FamilyTotal> {
    #[derive(Default)]
    struct Totals<'a> {
        runs: usize,
        failed: usize,
        tokens: u64,
        cost: FindingCost,
        sessions: std::collections::BTreeSet<&'a str>,
    }
    let mut families: BTreeMap<&str, Totals<'_>> = BTreeMap::new();
    for run in runs {
        let Some(family) = run.family.as_deref().filter(|family| !family.is_empty()) else {
            continue;
        };
        let totals = families.entry(family).or_default();
        totals.runs += 1;
        totals.failed += usize::from(run.failed);
        totals.tokens += run.tokens.unwrap_or(0);
        totals.cost.add(run.cost);
        totals.sessions.insert(&run.reference);
    }
    let several = families
        .values()
        .flat_map(|totals| totals.sessions.iter())
        .collect::<std::collections::BTreeSet<_>>()
        .len()
        > 1;
    let mut families: Vec<(FindingCost, FamilyTotal)> = families
        .into_iter()
        .map(|(family, totals)| {
            (
                totals.cost,
                FamilyTotal {
                    family: family.to_owned(),
                    runs: totals.runs,
                    failed: totals.failed,
                    sessions: several.then_some(totals.sessions.len()),
                    result_tokens: totals.tokens,
                    result_token_turns: totals.cost.token_turns,
                    result_estimated_cost: totals.cost.usd,
                },
            )
        })
        .collect();
    families.sort_by(|(a, _), (b, _)| b.rank().total_cmp(&a.rank()));
    families
        .into_iter()
        .take(limit)
        .map(|(_, family)| family)
        .collect()
}

/// Tools listed for each session.
const TOOL_LIMIT: usize = 6;

/// The tools whose results or definitions cost the most, most expensive first.
fn tool_totals(analysis: &Analysis, costs: &[ItemCost], runs: &[ToolRun]) -> Vec<ToolTotal> {
    #[derive(Default)]
    struct Totals {
        results: Vec<u64>,
        failed: usize,
        result_cost: FindingCost,
        definition_tokens: Option<u64>,
        definition_cost: FindingCost,
    }
    let mut tools: BTreeMap<String, Totals> = BTreeMap::new();
    for run in runs {
        let totals = tools.entry(run.tool.clone()).or_default();
        totals.results.push(run.tokens.unwrap_or(0));
        totals.failed += usize::from(run.failed);
        totals.result_cost.add(run.cost);
    }
    for (item, cost) in analysis.context_items.iter().zip(costs) {
        if item.kind != "toolDefinition" {
            continue;
        }
        let name = item
            .metadata
            .get("toolName")
            .cloned()
            .unwrap_or_else(|| item.label.trim_end_matches(" definition").to_owned());
        let totals = tools.entry(name).or_default();
        totals.definition_tokens = totals.definition_tokens.max(cost.tokens);
        totals.definition_cost.add(cost.cost);
    }
    let mut tools: Vec<(FindingCost, ToolTotal)> = tools
        .into_iter()
        .map(|(name, mut totals)| {
            totals.results.sort_unstable();
            let mut all = totals.result_cost;
            all.add(totals.definition_cost);
            let tool = ToolTotal {
                name,
                calls: totals.results.len(),
                failed: totals.failed,
                result_tokens: TokenStats {
                    total: totals.results.iter().sum(),
                    max: totals.results.last().copied().unwrap_or(0),
                },
                result_token_turns: totals.result_cost.token_turns,
                result_estimated_cost: totals.result_cost.usd,
                definition_tokens: totals.definition_tokens,
                definition_estimated_cost: totals.definition_cost.usd,
            };
            (all, tool)
        })
        .collect();
    tools.sort_by(|(a, _), (b, _)| b.rank().total_cmp(&a.rank()));
    tools
        .into_iter()
        .take(TOOL_LIMIT)
        .map(|(_, tool)| tool)
        .collect()
}

/// The calls that wrote compaction summaries: those a compaction names as its own, and those
/// marked by their stop reason.
fn compaction_calls(analysis: &Analysis) -> CompactionCalls {
    let named: HashSet<usize> = analysis
        .compactions
        .iter()
        .filter_map(|compaction| compaction.details.summary_call)
        .collect();
    let calls: Vec<&ModelCall> = analysis
        .model_calls
        .iter()
        .filter(|call| {
            named.contains(&call.index)
                || matches!(
                    call.stop_reason.as_deref(),
                    Some("compaction-call" | "compaction-aggregate")
                )
        })
        .collect();
    let amounts: Vec<f64> = calls
        .iter()
        .filter_map(|call| call.cost_assessment.amount)
        .collect();
    CompactionCalls {
        calls: calls.len(),
        usd: (!amounts.is_empty()).then(|| amounts.iter().sum()),
    }
}
