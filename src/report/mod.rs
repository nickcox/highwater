//! `highwater report`, `show` and `skill`: a summary of where sessions spent tokens, for an
//! agent skill (or a person) to suggest ways to use fewer. See docs/report.md.

mod build;
mod figures;
mod findings;
mod repository;
mod shared;
mod skill;
mod turns;
pub(crate) use turns::{session, SessionArgs};
#[cfg(test)]
mod tests;
mod text;
mod types;

pub(crate) use skill::{skill, SkillArgs};

use crate::{
    analysis::{analyze, AnalysisConfig},
    api::Analysis,
    domain::NormalizedSession,
    server::{discover_sessions, SessionFile, SourceArgs, TokenizationArg},
    source::{self, SessionLocator},
};
use chrono::{DateTime, NaiveDate, Utc};
use clap::Args;
use std::{
    collections::{BTreeSet, HashMap},
    io::Write,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicUsize, Ordering},
        Mutex,
    },
};
use types::{Report, Scope, Skipped, Thresholds};

/// Command families listed over all the sessions.
const FAMILY_LIMIT: usize = 12;

/// Bumped when a field is removed or changes meaning.
const REPORT_SCHEMA_VERSION: u32 = 2;

#[derive(Args, Debug)]
pub(crate) struct ReportArgs {
    /// Sessions to report on, by reference (the `session=` value of a view link). When
    /// given, the scope options are ignored.
    sessions: Vec<String>,
    /// Report on sessions from every directory.
    #[arg(long, conflicts_with = "dir")]
    all: bool,
    /// Report on sessions run in this directory's git repository, including its other
    /// worktrees, or in this directory when it is not in one. Defaults to the current
    /// directory.
    #[arg(long)]
    dir: Option<PathBuf>,
    /// How many of the most recently updated sessions to report on. Child sessions of those
    /// sessions are included and not counted. Sessions that made no calls are skipped.
    #[arg(long, default_value_t = 10)]
    last: usize,
    /// Only sessions updated on or after this date (YYYY-MM-DD, UTC).
    #[arg(long)]
    since: Option<NaiveDate>,
    /// Only sessions from this harness: pi, opencode, claude-code, codex, copilot or vscode-copilot.
    #[arg(long)]
    harness: Option<String>,
    /// Write the report as JSON, for an agent to read, instead of text.
    #[arg(long)]
    json: bool,
    #[arg(long, value_enum, default_value_t = TokenizationArg::Auto)]
    tokenization: TokenizationArg,
    /// Findings listed for each pattern: the most expensive over all the sessions, and
    /// the same number again across sessions.
    #[arg(long, default_value_t = 10)]
    limit: usize,
    #[command(flatten)]
    sources: SourceArgs,
}

#[derive(Args, Debug)]
pub(crate) struct ShowArgs {
    /// The session's reference.
    session: String,
    /// The item's ID, as a report's finding gives it.
    item: String,
    /// Stop after about this many tokens (four characters each).
    #[arg(long, default_value_t = 4000)]
    max_tokens: usize,
    /// One-based inclusive line range, for example 10..20.
    #[arg(long, conflicts_with = "grep", value_parser = parse_lines)]
    lines: Option<(usize, usize)>,
    /// Regular expression to match against each line.
    #[arg(long)]
    grep: Option<String>,
    /// Lines of context on either side of each match.
    #[arg(long, requires = "grep", default_value_t = 0)]
    around: usize,
    /// Skip this many characters of the selected text.
    #[arg(long, default_value_t = 0)]
    offset: usize,
    #[command(flatten)]
    sources: SourceArgs,
}

type Error = Box<dyn std::error::Error>;

pub(crate) fn run(args: ReportArgs) -> Result<(), Error> {
    let config = AnalysisConfig {
        tokenization: args.tokenization.into(),
        perf_diagnostics: false,
    };
    let sessions = if args.sessions.len() == 1 {
        crate::server::discover_session_sources(args.sources.clone(), &args.sessions[0])?
    } else {
        discover_sessions(args.sources.clone())?
    };
    let (scope, groups) = select(&sessions, &args)?;
    let thresholds = Thresholds::default();
    let analysed = analyse_groups(&groups, scope.last, config);
    let mut reports = Vec::new();
    let mut skipped = Vec::new();
    let mut price_data = None;
    for (session, result) in analysed {
        match result {
            Ok((normalized, analysis)) => {
                price_data.get_or_insert_with(|| {
                    analysis
                        .session
                        .cost_summary
                        .price_data
                        .models_dev_commit
                        .clone()
                });
                reports.push(build::session_report(
                    session,
                    &normalized,
                    &analysis,
                    &thresholds,
                    args.limit,
                ));
            }
            Err(reason) => skipped.push(Skipped {
                reference: session.id.clone(),
                reason,
            }),
        }
    }
    findings::keep_top(&mut reports, args.limit);
    let command_families = build::family_totals(
        reports.iter().flat_map(|report| report.runs.iter()),
        FAMILY_LIMIT,
    );
    let across_sessions = findings::across_sessions(&reports, &thresholds, args.limit);
    let children: Vec<(String, String)> = reports
        .iter()
        .filter_map(|report| Some((report.parent.clone()?, report.reference.clone())))
        .collect();
    for report in &mut reports {
        report.drop_working_data();
        report.child_sessions = children
            .iter()
            .filter(|(parent, _)| *parent == report.reference)
            .map(|(_, child)| child.clone())
            .collect();
    }
    let report = Report {
        schema_version: REPORT_SCHEMA_VERSION,
        highwater_version: env!("CARGO_PKG_VERSION"),
        price_data_commit: price_data,
        scope,
        thresholds,
        command_families,
        cost_by_context_size: figures::sum_bands(&reports),
        cache_rewrites: figures::sum_rewrites(&reports),
        turns_by_starter: figures::sum_turns(&reports),
        sessions: reports,
        across_sessions,
        skipped,
    };
    let mut out = std::io::stdout().lock();
    if args.json {
        serde_json::to_writer(&mut out, &report)?;
        writeln!(out)?;
    } else {
        text::write(&mut out, &report)?;
    }
    Ok(())
}

/// Analyses the groups in order until `last` of them have a session that made calls (all
/// of them when `last` is `None`). A session with no calls, such as a fork that was never
/// used, is left out unless it was named on the command line.
fn analyse_groups<'a>(
    groups: &[Vec<&'a SessionFile>],
    last: Option<usize>,
    config: AnalysisConfig,
) -> Vec<(&'a SessionFile, Analysed)> {
    let mut kept = Vec::new();
    let mut remaining = groups.iter();
    let mut wanted = last.unwrap_or(groups.len());
    while wanted > 0 {
        let batch: Vec<&Vec<&SessionFile>> = remaining.by_ref().take(wanted).collect();
        if batch.is_empty() {
            break;
        }
        let sessions: Vec<&SessionFile> = batch
            .iter()
            .flat_map(|group| group.iter().copied())
            .collect();
        let mut results = sessions.iter().copied().zip(analyse_all(&sessions, config));
        for group in batch {
            let group_results: Vec<_> = results
                .by_ref()
                .take(group.len())
                .filter(|(_, result)| {
                    last.is_none()
                        || !matches!(result, Ok((_, analysis)) if analysis.model_calls.is_empty())
                })
                .collect();
            if !group_results.is_empty() {
                wanted -= 1;
                kept.extend(group_results);
            }
        }
    }
    kept
}

/// The sessions in scope, most recently updated first, each in a group with its child
/// sessions after it. Sessions named on the command line are one group each.
fn select<'a>(
    sessions: &'a [SessionFile],
    args: &ReportArgs,
) -> Result<(Scope, Vec<Vec<&'a SessionFile>>), Error> {
    if !args.sessions.is_empty() {
        let mut selected = Vec::new();
        for reference in &args.sessions {
            let session = sessions
                .iter()
                .find(|session| &session.id == reference)
                .ok_or_else(|| format!("no session has the reference {reference}"))?;
            selected.push(vec![session]);
        }
        return Ok((Scope::sessions(), selected));
    }
    let directory = match (&args.dir, args.all) {
        (_, true) => None,
        (Some(dir), false) => Some(dir.clone()),
        (None, false) => Some(std::env::current_dir()?),
    };
    let matcher = directory.as_deref().map(DirectoryMatcher::new);
    let since = args
        .since
        .and_then(|date| date.and_hms_opt(0, 0, 0))
        .map(|time| time.and_utc());
    let mut cache = HashMap::new();
    let mut top_level: Vec<&SessionFile> = sessions
        .iter()
        .filter(|session| session.parent_reference.is_none())
        .filter(|session| {
            args.harness
                .as_deref()
                .is_none_or(|harness| session.harness.as_str() == harness)
        })
        .filter(|session| since.is_none_or(|since| updated(session).is_some_and(|at| at >= since)))
        .filter(|session| {
            matcher.as_ref().is_none_or(|matcher| {
                session
                    .working_directory
                    .as_deref()
                    .is_some_and(|dir| matcher.matches(Path::new(dir), &mut cache))
            })
        })
        .collect();
    top_level.sort_by_key(|session| std::cmp::Reverse(updated(session)));
    let mut selected = Vec::new();
    for parent in top_level {
        let mut group = vec![parent];
        let mut stack = vec![parent.id.as_str()];
        while let Some(reference) = stack.pop() {
            for child in sessions
                .iter()
                .filter(|session| session.parent_reference.as_deref() == Some(reference))
            {
                group.push(child);
                stack.push(child.id.as_str());
            }
        }
        selected.push(group);
    }
    let scope = Scope {
        kind: if directory.is_some() {
            "directory"
        } else {
            "all"
        },
        directory: directory.map(|dir| dir.display().to_string()),
        repository: matcher
            .and_then(|matcher| matcher.repository)
            .map(|repository| repository.display().to_string()),
        last: Some(args.last),
        since: args.since.map(|date| date.to_string()),
        harness: args.harness.clone(),
    };
    Ok((scope, selected))
}

fn updated(session: &SessionFile) -> Option<DateTime<Utc>> {
    session.modified_at.or(session.started_at)
}

/// Whether a session's working directory is in scope: in the same git repository (any of
/// its worktrees), or inside the directory itself.
struct DirectoryMatcher {
    directory: PathBuf,
    repository: Option<PathBuf>,
}

impl DirectoryMatcher {
    fn new(directory: &Path) -> Self {
        let directory = std::fs::canonicalize(directory).unwrap_or_else(|_| directory.into());
        let repository = repository::repository_of(&directory);
        Self {
            directory,
            repository,
        }
    }

    fn matches(&self, dir: &Path, cache: &mut HashMap<PathBuf, Option<PathBuf>>) -> bool {
        let canonical = std::fs::canonicalize(dir).unwrap_or_else(|_| dir.into());
        if canonical.starts_with(&self.directory) {
            return true;
        }
        let Some(repository) = &self.repository else {
            return false;
        };
        cache
            .entry(canonical)
            .or_insert_with_key(|dir| repository::repository_of(dir))
            .as_ref()
            == Some(repository)
    }
}

type Analysed = Result<(NormalizedSession, Analysis), String>;

/// Analyses sessions on one thread per processor, keeping their order.
fn analyse_all(sessions: &[&SessionFile], config: AnalysisConfig) -> Vec<Analysed> {
    let next = AtomicUsize::new(0);
    let results = Mutex::new((0..sessions.len()).map(|_| None).collect::<Vec<_>>());
    let workers = std::thread::available_parallelism()
        .map_or(2, usize::from)
        .min(sessions.len().max(1));
    std::thread::scope(|scope| {
        for _ in 0..workers {
            scope.spawn(|| loop {
                let position = next.fetch_add(1, Ordering::Relaxed);
                let Some(session) = sessions.get(position) else {
                    break;
                };
                let result = analyse(&session.source_locator(), config);
                if let Ok(mut results) = results.lock() {
                    results[position] = Some(result);
                }
            });
        }
    });
    results
        .into_inner()
        .unwrap_or_default()
        .into_iter()
        .map(|result| result.unwrap_or_else(|| Err("analysis did not finish".into())))
        .collect()
}

/// Loads and analyses one session as the server does, keeping the normalized session for
/// the tool calls' arguments and the items' text.
fn analyse(locator: &SessionLocator, config: AnalysisConfig) -> Analysed {
    let loaded = source::load(locator, None).map_err(|error| error.to_string())?;
    let normalized = loaded.normalized.clone();
    let mut analysis = analyze(loaded.normalized, config).map_err(|error| error.to_string())?;
    source::add_reconstruction(&mut analysis, loaded.limitations);
    Ok((normalized, analysis))
}

pub(crate) fn show(args: ShowArgs) -> Result<(), Error> {
    let sessions = crate::server::discover_session_sources(args.sources.clone(), &args.session)?;
    let session = sessions
        .iter()
        .find(|session| session.id == args.session)
        .ok_or_else(|| format!("no session has the reference {}", args.session))?;
    let loaded = source::load(&session.source_locator(), None)?;
    let item = loaded
        .normalized
        .context_items
        .iter()
        .find(|item| item.id == args.item)
        .ok_or_else(|| {
            if args.item.contains("unrecorded") {
                format!(
                    "{} is measured from reported usage and has no text",
                    args.item
                )
            } else {
                format!("the session has no item {}; find item IDs in the report's findings and largestItems", args.item)
            }
        })?;
    let mut out = std::io::stdout().lock();
    writeln!(out, "{} ({})", item.label, item.kind.as_str())?;
    if let Some(id) = &item.source_tool_call_id {
        writeln!(out, "Tool call: {id}")?;
        if let Some(call) = tool_call_text(&loaded.normalized, id) {
            writeln!(out, "{call}")?;
        }
    }
    writeln!(out)?;
    let text = crate::analysis::item_text(&item.payload);
    write_selection(&mut out, &text, &args)?;
    Ok(())
}

/// Distinct values, in order of first appearance.
fn distinct<T: Ord + Clone>(values: impl IntoIterator<Item = T>) -> Vec<T> {
    let mut seen = BTreeSet::new();
    values
        .into_iter()
        .filter(|value| seen.insert(value.clone()))
        .collect()
}

fn parse_lines(value: &str) -> Result<(usize, usize), String> {
    let invalid = || "expected a one-based inclusive range A..B".to_string();
    let (a, b) = value.split_once("..").ok_or_else(invalid)?;
    let a = a.parse::<usize>().map_err(|_| invalid())?;
    let b = b.parse::<usize>().map_err(|_| invalid())?;
    if a == 0 || b < a {
        return Err(invalid());
    }
    Ok((a, b))
}

fn tool_call_text(session: &NormalizedSession, id: &str) -> Option<String> {
    use crate::domain::{AssistantContentBlock, TokenizationPayload};
    session.context_items.iter().find_map(|item| {
        let TokenizationPayload::AssistantMessage { blocks, .. } = &item.payload else {
            return None;
        };
        blocks.iter().find_map(|block| match block {
            AssistantContentBlock::ToolCall {
                id: call_id,
                name,
                arguments,
            } if call_id == id => {
                let shown: String = arguments.chars().take(500).collect();
                let suffix = if arguments.chars().count() > 500 {
                    "…"
                } else {
                    ""
                };
                Some(format!("{name} {shown}{suffix}"))
            }
            _ => None,
        })
    })
}

fn write_selection(out: &mut impl Write, text: &str, args: &ShowArgs) -> Result<(), Error> {
    let selected;
    let mut match_summary = None;
    let text = if args.lines.is_some() || args.grep.is_some() {
        let lines: Vec<_> = text.lines().collect();
        let mut include = vec![false; lines.len()];
        let mut matches = vec![false; lines.len()];
        if let Some((a, b)) = args.lines {
            let start = a.saturating_sub(1).min(lines.len());
            include[start..b.min(lines.len())].fill(true);
        } else if let Some(pattern) = &args.grep {
            let regex = regex::Regex::new(pattern)?;
            for (index, line) in lines.iter().enumerate() {
                if regex.is_match(line) {
                    matches[index] = true;
                    let start = index.saturating_sub(args.around);
                    let end = index
                        .saturating_add(args.around)
                        .saturating_add(1)
                        .min(lines.len());
                    include[start..end].fill(true);
                }
            }
            let count = matches.iter().filter(|matched| **matched).count();
            match_summary = Some(if count == 0 {
                format!("[No matching lines out of {}]", lines.len())
            } else {
                format!("[{count} matching lines of {}]", lines.len())
            });
        }
        let mut rendered = Vec::new();
        let mut previous = None;
        for (index, line) in lines.iter().enumerate() {
            if !include[index] {
                continue;
            }
            if previous.is_some_and(|last| index > last + 1) {
                rendered.push("--".to_string());
            }
            let separator = if args.grep.is_some() && !matches[index] {
                ' '
            } else {
                ':'
            };
            rendered.push(format!("{:>4}{separator} {line}", index + 1));
            previous = Some(index);
        }
        selected = rendered.join("\n");
        selected.as_str()
    } else {
        text
    };
    let total = text.chars().count();
    let limit = args.max_tokens.saturating_mul(4);
    let shown: String = text.chars().skip(args.offset).take(limit).collect();
    if !shown.is_empty() || match_summary.is_none() {
        writeln!(out, "{shown}")?;
    }
    if let Some(summary) = match_summary {
        writeln!(out, "{summary}")?;
    }
    let next = args.offset.saturating_add(shown.chars().count());
    if next < total {
        writeln!(out, "\n[Cut at about {} tokens: {} of {} characters; continue with --offset {} (keep the other options unchanged)]", args.max_tokens, next, total, next)?;
    }
    Ok(())
}
