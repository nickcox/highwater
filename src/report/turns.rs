//! Turn-level inspection using the report's turn boundaries, prices and tool runs.
use super::*;
use clap::{Subcommand, ValueEnum};
use serde::Serialize;

#[derive(Args, Debug)]
pub(crate) struct SessionArgs {
    #[command(subcommand)]
    command: SessionCommand,
}

#[derive(Subcommand, Debug)]
enum SessionCommand {
    /// Find sessions by scope and catalogue text.
    List(super::list::ListArgs),
    /// List turns, their costs, tool activity and prompt starts.
    Turns(TurnsArgs),
    /// Print a context item's text, with optional line or pattern selection.
    Show(ShowArgs),
}

#[derive(Clone, Copy, Debug, Default, ValueEnum)]
enum Sort {
    #[default]
    Order,
    Cost,
    Calls,
}

#[derive(Args, Debug)]
struct TurnsArgs {
    /// The session's reference, including its harness prefix.
    session: String,
    #[arg(long, value_enum, default_value_t = Sort::Order)]
    sort: Sort,
    /// Maximum number of turns to print.
    #[arg(long, default_value_t = 30)]
    limit: usize,
    /// Skip this many turns after sorting.
    #[arg(long, default_value_t = 0)]
    offset: usize,
    /// Write structured JSON instead of a table.
    #[arg(long)]
    json: bool,
    #[arg(long, value_enum, default_value_t = TokenizationArg::Auto)]
    tokenization: TokenizationArg,
    #[command(flatten)]
    sources: SourceArgs,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct TurnRow {
    turn: usize,
    first_call: usize,
    last_call: usize,
    break_seconds: Option<i64>,
    first_prompt_tokens: Option<u64>,
    last_prompt_tokens: Option<u64>,
    usd: Option<f64>,
    tool_calls: usize,
    failed_tool_calls: usize,
    most_run: Vec<(String, usize)>,
    starter: String,
    prompt: Option<String>,
}

pub(super) fn rows(
    session: &SessionFile,
    normalized: &NormalizedSession,
    analysis: &Analysis,
) -> Vec<TurnRow> {
    let costs = shared::item_costs(analysis, normalized);
    let runs = shared::tool_runs(session, normalized, analysis, &costs);
    shared::report_turns(analysis)
        .iter()
        .enumerate()
        .map(|(index, turn)| {
            let calls = &analysis.model_calls[turn.first_call - 1..turn.last_call];
            let first = &calls[0];
            let pause = turn
                .first_call
                .checked_sub(2)
                .and_then(|i| analysis.model_calls[i].timing.recorded_at_ms)
                .zip(first.timing.started_at_ms.or(first.timing.recorded_at_ms))
                .map(|(end, start)| (start - end) / 1000)
                .filter(|seconds| *seconds > 300);
            let tools: Vec<_> = runs
                .iter()
                .filter(|run| (turn.first_call..=turn.last_call).contains(&run.first_call))
                .collect();
            let mut counts = std::collections::BTreeMap::new();
            for run in &tools {
                *counts
                    .entry(run.family.as_ref().unwrap_or(&run.tool).clone())
                    .or_insert(0usize) += 1;
            }
            let mut most_run: Vec<_> = counts.into_iter().collect();
            most_run.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
            most_run.truncate(2);
            let mut usd = None;
            for call in calls {
                if let Some(amount) = call.cost_assessment.amount {
                    *usd.get_or_insert(0.0) += amount;
                }
            }
            TurnRow {
                turn: index + 1,
                first_call: turn.first_call,
                last_call: turn.last_call,
                break_seconds: pause,
                first_prompt_tokens: first.reported_prompt_tokens,
                last_prompt_tokens: calls.last().unwrap().reported_prompt_tokens,
                usd: figures::rounded(usd),
                tool_calls: tools.len(),
                failed_tool_calls: tools.iter().filter(|run| run.failed).count(),
                most_run,
                starter: turn.starter.into(),
                prompt: turn.prompt.map(|p| p.chars().take(80).collect()),
            }
        })
        .collect()
}

pub(crate) fn session(args: SessionArgs) -> Result<(), Error> {
    match args.command {
        SessionCommand::List(args) => super::list::run(args),
        SessionCommand::Show(args) => show(args),
        SessionCommand::Turns(args) => turns(args),
    }
}

fn format_context(tokens: Option<u64>) -> String {
    tokens
        .map(|n| format!("{:.0}K", n as f64 / 1000.0))
        .unwrap_or_else(|| "?".into())
}

fn format_break(seconds: Option<i64>) -> String {
    seconds
        .map(|s| {
            if s < 90 * 60 {
                format!("{:.0} min", s as f64 / 60.0)
            } else {
                format!("{:.1} h", s as f64 / 3600.0)
            }
        })
        .unwrap_or_default()
}

fn clipped(text: &str, width: usize) -> String {
    let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if text.chars().count() <= width {
        text
    } else {
        format!(
            "{}…",
            text.chars()
                .take(width.saturating_sub(1))
                .collect::<String>()
        )
    }
}

fn footer(total: usize, offset: usize, shown: usize) -> String {
    let next = offset.saturating_add(shown);
    let later = total.saturating_sub(next);
    if later > 0 {
        format!("[{later} more turns: --offset {next}, or --sort cost]")
    } else if offset > 0 && total > 0 {
        format!(
            "[{} earlier turns: --offset 0, or --sort cost]",
            offset.min(total)
        )
    } else {
        "[0 more turns]".into()
    }
}

fn turns(args: TurnsArgs) -> Result<(), Error> {
    let sessions = crate::server::discover_session_sources(args.sources, &args.session)?;
    let session = sessions
        .iter()
        .find(|s| s.id == args.session)
        .ok_or_else(|| format!("no session has the reference {}", args.session))?;
    let (normalized, analysis) = analyse(
        &session.source_locator(),
        AnalysisConfig {
            tokenization: args.tokenization.into(),
            perf_diagnostics: false,
        },
    )?;
    let mut rows = rows(session, &normalized, &analysis);
    match args.sort {
        Sort::Order => {}
        Sort::Cost => rows.sort_by(|a, b| {
            b.usd
                .partial_cmp(&a.usd)
                .unwrap_or(std::cmp::Ordering::Equal)
        }),
        Sort::Calls => {
            rows.sort_by_key(|row| std::cmp::Reverse(row.last_call - row.first_call + 1))
        }
    }
    let total = rows.len();
    let selected: Vec<_> = rows.iter().skip(args.offset).take(args.limit).collect();
    let omitted = total - selected.len();
    let mut out = std::io::stdout().lock();
    if args.json {
        serde_json::to_writer(
            &mut out,
            &serde_json::json!({"reference": args.session, "totalTurns": total,
            "omittedTurns": omitted, "turns": selected}),
        )?;
        writeln!(out)?;
    } else {
        let user_turns = rows.iter().filter(|row| row.starter == "user").count();
        let usd = analysis
            .model_calls
            .iter()
            .filter_map(|call| call.cost_assessment.amount)
            .reduce(|sum, amount| sum + amount);
        let cost = usd
            .map(|usd| format!("${usd:.2} (estimate)"))
            .unwrap_or_else(|| "? (unknown cost)".into());
        writeln!(
            out,
            "{} · {} calls · {} turns ({} by the user) · {} · {} compactions",
            args.session,
            analysis.model_calls.len(),
            total,
            user_turns,
            cost,
            analysis.compactions.len()
        )?;
        writeln!(
            out,
            "{:<5} {:>7} {:>7}  {:>11}  {:>7}  {:>5} {:>6}  {:<24}  prompt",
            "turn", "calls", "break", "context", "cost", "tools", "failed", "most run"
        )?;
        for row in &selected {
            let pause = format_break(row.break_seconds);
            let cost = row
                .usd
                .map(|v| format!("${v:.2}"))
                .unwrap_or_else(|| "?".into());
            let most = row
                .most_run
                .iter()
                .map(|(name, n)| format!("{name} {n}"))
                .collect::<Vec<_>>()
                .join(", ");
            let prompt = row
                .prompt
                .as_ref()
                .map(|p| format!("{:?}", clipped(p, 60)))
                .unwrap_or_else(|| format!("[{}]", row.starter));
            writeln!(
                out,
                "t{:<4} {:>3}–{:<3} {:>7}  {:>4} → {:>4}  {:>7}  {:>5} {:>6}  {:<24}  {}",
                row.turn,
                row.first_call,
                row.last_call,
                pause,
                format_context(row.first_prompt_tokens),
                format_context(row.last_prompt_tokens),
                cost,
                row.tool_calls,
                row.failed_tool_calls,
                clipped(&most, 24),
                prompt
            )?;
        }
        writeln!(out, "{}", footer(total, args.offset, selected.len()))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compact_text_formats_context_breaks_and_columns() {
        assert_eq!(format_context(Some(360329)), "360K");
        assert_eq!(format_context(Some(382605)), "383K");
        assert_eq!(format_context(None), "?");
        assert_eq!(format_break(Some(360)), "6 min");
        assert_eq!(format_break(Some(5399)), "90 min");
        assert_eq!(format_break(Some(5400)), "1.5 h");
        assert_eq!(format_break(Some(8640)), "2.4 h");
        assert_eq!(format_break(None), "");
        assert_eq!(clipped("a\nb\tc", 24), "a b c");
        assert_eq!(clipped(&"é".repeat(30), 24).chars().count(), 24);
        assert_eq!(
            format!("{:<24}", clipped("git diff 2", 24)).chars().count(),
            24
        );
        assert_eq!(clipped(&"x".repeat(80), 60).chars().count(), 60);
    }

    #[test]
    fn footer_counts_only_later_turns_unless_at_the_end() {
        assert_eq!(
            footer(31, 9, 5),
            "[17 more turns: --offset 14, or --sort cost]"
        );
        assert_eq!(
            footer(31, 30, 1),
            "[30 earlier turns: --offset 0, or --sort cost]"
        );
        assert_eq!(
            footer(31, 100, 0),
            "[31 earlier turns: --offset 0, or --sort cost]"
        );
        assert_eq!(footer(31, 0, 31), "[0 more turns]");
        assert_eq!(footer(0, 0, 0), "[0 more turns]");
    }
}
