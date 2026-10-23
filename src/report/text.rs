//! The report as text, for reading in a terminal.

use super::types::{FamilyTotal, Finding, FindingCost, Report, SessionReport};
use crate::domain::grouped;
use std::io::{self, Write};

/// Tools listed for each session.
const TOOL_LIMIT: usize = 5;
/// Kinds of context item listed for each session.
const KIND_LIMIT: usize = 4;

pub(super) fn write(out: &mut impl Write, report: &Report) -> io::Result<()> {
    let children = report
        .sessions
        .iter()
        .filter(|session| session.parent.is_some())
        .count();
    let count = report.sessions.len() - children;
    let mut heading = plural(count, "session");
    if children > 0 {
        heading.push_str(&format!(" and {}", plural(children, "child session")));
    }
    match (report.scope.kind, &report.scope.directory) {
        ("directory", Some(directory)) => {
            heading.push_str(&format!(" from {directory}"));
            if report.scope.repository.is_some() {
                heading.push_str(" and its repository's other worktrees");
            }
        }
        ("all", _) => heading.push_str(" from every directory"),
        _ => {}
    }
    writeln!(out, "{heading}")?;
    writeln!(
        out,
        "Costs are estimates. For calls covered by a subscription they are what the API would have charged."
    )?;
    if !report.command_families.is_empty() {
        writeln!(out, "\nShell commands by family, over all sessions")?;
        for family in &report.command_families {
            write_family(out, family)?;
        }
    }
    if !report.across_sessions.is_empty() {
        writeln!(out, "\nAcross sessions")?;
        for finding in &report.across_sessions {
            write_finding(out, finding, None)?;
        }
    }
    for session in &report.sessions {
        write_session(out, session)?;
    }
    for skipped in &report.skipped {
        writeln!(out, "\nSkipped {}: {}", skipped.reference, skipped.reason)?;
    }
    Ok(())
}

fn write_session(out: &mut impl Write, session: &SessionReport) -> io::Result<()> {
    let date = session
        .updated_at
        .as_deref()
        .and_then(|at| at.get(..10))
        .unwrap_or("undated");
    let child = if session.parent.is_some() {
        "child session · "
    } else {
        ""
    };
    writeln!(
        out,
        "\n{} · {child}{} · {} · {date}",
        session.reference, session.title, session.harness
    )?;
    let mut facts = vec![plural(session.calls, "call")];
    if !session.models.is_empty() {
        facts.push(session.models.join(", "));
    }
    if let Some(cost) = session.cost.billed {
        facts.push(format!("{} billed", usd(cost.low)));
    }
    if let Some(cost) = session.cost.api_equivalent {
        facts.push(format!("{} API-equivalent", usd(cost.low)));
    }
    if let Some(average) = session.average_context_tokens {
        // Failed attempts are left out of the count: they recorded nothing to miss.
        let prompt = session.tokens.coverage.prompt;
        let coverage = if prompt.missing_calls > 0 {
            format!(
                " ({} of {} calls recorded)",
                prompt.recorded_calls,
                prompt.recorded_calls + prompt.missing_calls
            )
        } else {
            String::new()
        };
        facts.push(format!(
            "average context {} tokens{coverage}",
            grouped(average)
        ));
    }
    if let Some(peak) = session.peak_context_tokens {
        facts.push(format!("peak {}", grouped(peak)));
    }
    if session.user_turns > 1 {
        facts.push(plural(session.user_turns, "user turn"));
    }
    if session.compactions > 0 {
        facts.push(plural(session.compactions, "compaction"));
    }
    writeln!(out, "  {}", facts.join(" · "))?;
    let kinds: Vec<String> = session
        .context_by_kind
        .iter()
        .take(KIND_LIMIT)
        .map(|kind| format!("{} {:.0}%", kind.kind, kind.share * 100.0))
        .collect();
    writeln!(out, "  Context, by tokens sent: {}", kinds.join(", "))?;
    let carried = &session.carried_context;
    if carried.token_turns > 0 {
        writeln!(
            out,
            "  Conversation from {} or more user turns earlier: {:.0}% of tokens sent",
            carried.older_than_turns,
            carried.share * 100.0
        )?;
    }
    for tool in session
        .tools
        .iter()
        .filter(|tool| tool.calls > 0)
        .take(TOOL_LIMIT)
    {
        let failed = if tool.failed > 0 {
            format!(" ({} failed)", tool.failed)
        } else {
            String::new()
        };
        writeln!(
            out,
            "  {:>8}  {} · {}{failed} · {} tokens",
            cost(&FindingCost {
                usd: tool.result_estimated_cost,
                token_turns: tool.result_token_turns
            }),
            tool.name,
            plural(tool.calls, "result"),
            grouped(tool.result_tokens.total)
        )?;
    }
    if !session.command_families.is_empty() {
        writeln!(out, "  Shell commands")?;
    }
    for family in &session.command_families {
        write_family(out, family)?;
    }
    if !session.findings.is_empty() {
        writeln!(out, "  Findings")?;
        for finding in &session.findings {
            write_finding(out, finding, Some(&session.reference))?;
        }
    }
    Ok(())
}

fn write_family(out: &mut impl Write, family: &FamilyTotal) -> io::Result<()> {
    let failed = if family.failed > 0 {
        format!(" ({} failed)", family.failed)
    } else {
        String::new()
    };
    let sessions = family.sessions.map_or_else(String::new, |count| {
        format!(" in {}", plural(count, "session"))
    });
    writeln!(
        out,
        "  {:>8}  `{}` · {}{failed}{sessions} · {} tokens",
        cost(&FindingCost {
            usd: family.result_estimated_cost,
            token_turns: family.result_token_turns
        }),
        family.family,
        plural(family.runs, "run"),
        grouped(family.result_tokens)
    )
}

fn write_finding(out: &mut impl Write, finding: &Finding, session: Option<&str>) -> io::Result<()> {
    writeln!(
        out,
        "  {:>8}  {}",
        cost(&finding.estimated_cost),
        finding.summary
    )?;
    if let Some(item) = finding.items.first() {
        let reference = session.or(item.reference.as_deref()).unwrap_or("");
        writeln!(
            out,
            "            highwater show {reference} '{}'",
            item.item_id
        )?;
    }
    Ok(())
}

fn cost(cost: &FindingCost) -> String {
    cost.usd
        .map_or_else(|| format!("{}tt", grouped(cost.token_turns)), usd)
}

fn usd(value: f64) -> String {
    format!("${value:.2}")
}

fn plural(count: usize, noun: &str) -> String {
    let count_text = grouped(count as u64);
    if count == 1 {
        format!("{count_text} {noun}")
    } else {
        format!("{count_text} {noun}s")
    }
}
