//! Catalogue-only session listing.
use super::*;
use chrono::Local;
use serde::Serialize;

#[derive(Args, Debug)]
pub(super) struct ListArgs {
    #[command(flatten)]
    scope: ScopeArgs,
    /// Maximum number of top-level sessions to list.
    #[arg(long, default_value_t = 20)]
    last: usize,
    /// Match every word against the session's catalogue text, ignoring case.
    #[arg(long)]
    search: Option<String>,
    /// Include child sessions under their parent.
    #[arg(long)]
    children: bool,
    /// Write JSON instead of text.
    #[arg(long)]
    json: bool,
    #[command(flatten)]
    sources: SourceArgs,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Row<'a> {
    reference: &'a str,
    title: &'a str,
    harness: &'a str,
    updated_at: Option<DateTime<Utc>>,
    started_at: Option<DateTime<Utc>>,
    working_directory: &'a Option<String>,
    git_branch: &'a Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    git_branches: Option<&'a Vec<String>>,
    first_prompt: &'a Option<String>,
    parent: &'a Option<String>,
    subagent_type: &'a Option<String>,
    child_sessions: usize,
}

fn matches(session: &SessionFile, search: &str) -> bool {
    let text = format!(
        "{} {} {} {} {} {}",
        session.display_name,
        session.working_directory.as_deref().unwrap_or_default(),
        session.first_prompt.as_deref().unwrap_or_default(),
        session.git_branch.as_deref().unwrap_or_default(),
        session.git_branches.join(" "),
        session.id
    )
    .to_lowercase();
    search
        .split_whitespace()
        .all(|word| text.contains(&word.to_lowercase()))
}

pub(super) fn run(args: ListArgs) -> Result<(), Error> {
    let sessions =
        crate::server::discover_harness_sources(args.sources, args.scope.harness.as_deref())?;
    let (scope, groups) = select(&sessions, &args.scope, &[], args.last)?;
    let groups: Vec<_> = groups
        .into_iter()
        .filter(|group| {
            args.search
                .as_deref()
                .is_none_or(|search| group.iter().any(|session| matches(session, search)))
        })
        .collect();
    let more = groups.len().saturating_sub(args.last);
    let mut rows = Vec::new();
    for group in groups.iter().take(args.last) {
        for session in group
            .iter()
            .take(if args.children { group.len() } else { 1 })
        {
            rows.push(Row {
                reference: &session.id,
                title: &session.display_name,
                harness: session.harness.as_str(),
                updated_at: updated(session),
                started_at: session.started_at,
                working_directory: &session.working_directory,
                git_branch: &session.git_branch,
                git_branches: (session.git_branches.len() > 1).then_some(&session.git_branches),
                first_prompt: &session.first_prompt,
                parent: &session.parent_reference,
                subagent_type: &session.subagent_type,
                child_sessions: if session.id == group[0].id {
                    group.len() - 1
                } else {
                    sessions
                        .iter()
                        .filter(|child| child.parent_reference.as_deref() == Some(&session.id))
                        .count()
                },
            });
        }
    }
    let mut out = std::io::stdout().lock();
    if args.json {
        serde_json::to_writer(
            &mut out,
            &serde_json::json!({
                "schemaVersion": 1, "highwaterVersion": env!("CARGO_PKG_VERSION"),
                "scope": scope, "sessions": rows, "moreSessions": more
            }),
        )?;
        writeln!(out)?;
    } else {
        write_text(&mut out, &rows, &scope, more, args.last)?;
    }
    Ok(())
}

fn write_text(
    out: &mut impl Write,
    rows: &[Row<'_>],
    scope: &Scope,
    more: usize,
    last: usize,
) -> std::io::Result<()> {
    if rows.is_empty() {
        writeln!(
            out,
            "No sessions in scope: {}. Try --all or --dir DIR.",
            scope.directory.as_deref().unwrap_or("all directories")
        )?;
    }
    for row in rows {
        let indent = if row.parent.is_some() { "  " } else { "" };
        let time = row
            .updated_at
            .map(|at| {
                at.with_timezone(&Local)
                    .format("%Y-%m-%d %H:%M")
                    .to_string()
            })
            .unwrap_or_default();
        writeln!(
            out,
            "{indent}{} · {} · {} · {time}",
            row.reference, row.title, row.harness
        )?;
        let mut details = Vec::new();
        if let Some(dir) = row.working_directory {
            details.push(
                Path::new(dir)
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned(),
            );
        }
        if let Some(branch) = row.git_branch {
            details.push(branch.clone());
        }
        if let Some(kind) = row.subagent_type {
            details.push(kind.clone());
        }
        if row.child_sessions > 0 {
            details.push(format!(
                "{} child session{}",
                row.child_sessions,
                if row.child_sessions == 1 { "" } else { "s" }
            ));
        }
        if !details.is_empty() {
            writeln!(out, "{indent}  {}", details.join(" · "))?;
        }
        if let Some(prompt) = row.first_prompt {
            let prompt = prompt.split_whitespace().collect::<Vec<_>>().join(" ");
            let clipped: String = prompt.chars().take(100).collect();
            writeln!(
                out,
                "{indent}  {clipped}{}",
                if prompt.chars().count() > 100 {
                    "…"
                } else {
                    ""
                }
            )?;
        }
    }
    if more == 0 {
        writeln!(out, "[0 more sessions]")
    } else {
        writeln!(out, "[{more} more sessions: --last {}]", last + more)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_matches_catalogue_words_and_children_remain_in_scope() {
        let mut sessions = super::super::tests::fixture_sessions();
        let parent = sessions
            .iter_mut()
            .find(|session| session.parent_reference.is_none())
            .unwrap();
        parent.first_prompt = Some("Discuss Release timing".into());
        parent.git_branch = Some("feature/list".into());
        assert!(matches(parent, "RELEASE feature/list"));
        assert!(matches(parent, &parent.id));
        assert!(!matches(parent, "release missing-word"));
        let args = ScopeArgs {
            all: true,
            dir: None,
            since: None,
            harness: None,
        };
        let (_, groups) = select(&sessions, &args, &[], 1).unwrap();
        assert!(groups.len() > 1);
        assert!(groups
            .windows(2)
            .all(|pair| updated(pair[0][0]) >= updated(pair[1][0])));
    }

    #[test]
    fn text_has_an_empty_scope_hint_and_pagination() {
        let scope = Scope::sessions();
        let mut out = Vec::new();
        write_text(&mut out, &[], &scope, 12, 20).unwrap();
        let text = String::from_utf8(out).unwrap();
        assert!(text.contains("Try --all or --dir DIR"));
        assert!(text.contains("[12 more sessions: --last 32]"));
    }

    #[test]
    fn rows_use_nullable_catalogue_fields_and_indent_children() {
        let absent = None;
        let parent = Some("pi-parent".to_string());
        let row = Row {
            reference: "pi-child",
            title: "Child",
            harness: "pi",
            updated_at: None,
            started_at: None,
            working_directory: &absent,
            git_branch: &absent,
            git_branches: None,
            first_prompt: &absent,
            parent: &parent,
            subagent_type: &absent,
            child_sessions: 2,
        };
        let json = serde_json::to_value(&row).unwrap();
        assert!(json["updatedAt"].is_null());
        assert!(json["startedAt"].is_null());
        assert!(json["workingDirectory"].is_null());
        assert!(json["firstPrompt"].is_null());
        assert!(json.get("gitBranches").is_none());
        assert_eq!(json["parent"], "pi-parent");
        assert_eq!(json["childSessions"], 2);
        let mut out = Vec::new();
        write_text(&mut out, &[row], &Scope::sessions(), 0, 20).unwrap();
        let text = String::from_utf8(out).unwrap();
        assert!(text.starts_with("  pi-child · Child · pi"));
        assert!(text.contains("2 child sessions"));
        assert!(text.ends_with("[0 more sessions]\n"));
    }

    #[test]
    fn scope_filters_dates_and_harnesses_before_listing() {
        let sessions = super::super::tests::fixture_sessions();
        let mut args = ScopeArgs {
            all: true,
            dir: None,
            since: None,
            harness: Some("claude-code".into()),
        };
        let (_, groups) = select(&sessions, &args, &[], 20).unwrap();
        assert!(!groups.is_empty());
        assert!(groups
            .iter()
            .all(|group| group[0].harness.as_str() == "claude-code"));
        args.since = Some(NaiveDate::from_ymd_opt(2099, 1, 1).unwrap());
        assert!(select(&sessions, &args, &[], 20).unwrap().1.is_empty());
    }

    #[test]
    fn harness_discovery_does_not_read_other_sources() {
        let sources = SourceArgs {
            session_root: vec![PathBuf::from("/nonexistent/pi")],
            opencode_db: vec![PathBuf::from("Cargo.toml")],
            claude_root: vec![PathBuf::from("fixtures/claude-code/projects")],
            vscode_user_dir: vec![],
            codex_home: vec![],
            copilot_home: vec![],
        };
        let sessions =
            crate::server::discover_harness_sources(sources.clone(), Some("claude-code")).unwrap();
        assert!(!sessions.is_empty());
        assert!(sessions
            .iter()
            .all(|session| session.harness.as_str() == "claude-code"));
        let error = crate::server::discover_harness_sources(sources, Some("unknown"))
            .unwrap_err()
            .to_string();
        assert!(error.contains("expected pi, opencode, claude-code"));
    }
}
