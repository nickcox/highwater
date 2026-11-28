//! One session's report: totals from the analysis, each item's cost over its lifetime, and
//! the tool runs that findings are made from.

use super::types::{FindingCost, ToolRun};
use crate::{
    api::{Analysis, ContextItem},
    domain::{AssistantContentBlock, NormalizedSession, TokenizationPayload, ToolAction},
    pricing::{self, CallToPrice, InputPrice},
    server::SessionFile,
};
use serde_json::Value;
use std::{collections::HashMap, path::Path};

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

/// A report turn, with inclusive call bounds and the source's timing and status.
#[derive(Debug)]
pub(super) struct ReportTurn<'a> {
    pub first_call: usize,
    pub last_call: usize,
    pub starter: &'a str,
    pub prompt: Option<&'a str>,
    #[allow(dead_code)]
    pub recorded: Option<&'a crate::domain::RecordedTurn>,
}

/// Combine recorded requests and new messages without splitting a recorded request.
pub(super) fn report_turns(analysis: &Analysis) -> Vec<ReportTurn<'_>> {
    let messages: Vec<_> = analysis
        .context_items
        .iter()
        .filter(|item| item.kind == "userMessage" && !inherited(item))
        .filter_map(|item| Some((item.presence.first()?.start_call, item)))
        .collect();
    let mut starts = std::collections::BTreeSet::new();
    if !analysis.model_calls.is_empty() {
        starts.insert(1);
    }
    for turn in &analysis.turns {
        starts.insert(turn.first_call);
    }
    for (call, _) in &messages {
        if !analysis
            .turns
            .iter()
            .any(|turn| turn.first_call < *call && *call <= turn.last_call)
        {
            starts.insert(*call);
        }
    }
    let starts: Vec<_> = starts
        .into_iter()
        .filter(|call| *call > 0 && *call <= analysis.model_calls.len())
        .collect();
    starts
        .iter()
        .enumerate()
        .map(|(index, &first_call)| {
            let recorded = analysis
                .turns
                .iter()
                .find(|turn| turn.first_call == first_call);
            let at_start: Vec<_> = messages
                .iter()
                .filter(|(call, _)| *call == first_call)
                .map(|(_, item)| *item)
                .collect();
            let compaction = analysis.model_calls[first_call - 1].stop_reason.as_deref()
                == Some("compaction-call");
            let user = at_start.iter().rev().find(|item| {
                !compaction && item.metadata.get("sentBy").map(String::as_str) != Some("harness")
            });
            let starter = if compaction {
                "compaction"
            } else if user.is_some() {
                "user"
            } else {
                at_start
                    .iter()
                    .find_map(|item| item.metadata.get("turnStarter").map(String::as_str))
                    .or_else(|| recorded.and_then(|turn| turn.starter.as_deref()))
                    .unwrap_or("harness")
            };
            ReportTurn {
                first_call,
                last_call: starts
                    .get(index + 1)
                    .map_or(analysis.model_calls.len(), |next| next - 1),
                starter,
                prompt: if user.is_some() {
                    recorded
                        .and_then(|turn| turn.prompt.as_deref())
                        .or_else(|| {
                            user.map(|item| {
                                item.label.strip_prefix("User · ").unwrap_or(&item.label)
                            })
                        })
                } else {
                    None
                },
                recorded,
            }
        })
        .collect()
}

/// Cumulative user-turn count at each call, also used for carried context age.
pub(super) fn user_turns(analysis: &Analysis) -> Vec<usize> {
    let turns = report_turns(analysis);
    let mut result = vec![0; analysis.model_calls.len()];
    let mut count = 0;
    for turn in turns {
        count += usize::from(turn.starter == "user");
        result[turn.first_call - 1..turn.last_call].fill(count);
    }
    result
}

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
    let harness = analysis.session.source;
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
pub(super) fn tool_runs(
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
    let actions: HashMap<_, _> = normalized
        .model_calls
        .iter()
        .flat_map(|call| &call.tool_calls_after)
        .map(|tool_call| (tool_call.id.as_str(), tool_call.action.as_ref()))
        .collect();
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
            let id = tool_call_id.as_str();
            let action = actions.get(id).copied().flatten();
            let text = arguments.get(id).copied().unwrap_or_default();
            let command = command_key(action, text, &paths);
            let shell = matches!(action, Some(ToolAction::Shell { .. }));
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

/// Compare shell commands without a leading change of directory, and file reads by path.
/// For edits and tools the reader does not identify, compare canonical JSON arguments without
/// null fields, or the trimmed text when it is not JSON. Paths in the session's working tree
/// are written relative to its top folder.
pub(super) fn command_key(action: Option<&ToolAction>, arguments: &str, paths: &Paths) -> String {
    match action {
        Some(ToolAction::Shell { command }) => paths.in_text(without_cd(command.trim())),
        Some(ToolAction::ReadFile { path }) => paths.relative(path),
        Some(ToolAction::EditFile { .. }) | None => {
            let Ok(mut value) = serde_json::from_str::<Value>(arguments) else {
                return paths.in_text(arguments.trim());
            };
            if let Value::Object(fields) = &mut value {
                fields.retain(|_, field| !field.is_null());
            }
            paths.in_text(&value.to_string())
        }
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
