//! `highwater skill`: prints or installs the agent skill kept in `skills/`, so it needs no
//! separate download.

use clap::{Args, Subcommand, ValueEnum};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

const NAME: &str = "token-efficiency";
const SKILL: &str = include_str!("../../skills/token-efficiency/SKILL.md");

#[derive(Args, Debug)]
pub(crate) struct SkillArgs {
    #[command(subcommand)]
    action: Action,
}

#[derive(Subcommand, Debug)]
enum Action {
    /// Print the skill's SKILL.md.
    Print,
    /// Write the skill to an agent's skills folder.
    Install {
        /// Which agents' folder: `agents` (`.agents/skills`, read by Codex and other agents)
        /// or `claude-code` (`.claude/skills`).
        #[arg(long, value_enum, default_value_t = Agent::Agents)]
        agent: Agent,
        /// Install in the current git repository's folder instead of your home folder.
        #[arg(long, conflicts_with = "dir")]
        project: bool,
        /// Install in this skills folder instead.
        #[arg(long, conflicts_with = "agent")]
        dir: Option<PathBuf>,
        /// Replace an installed copy that differs from this version's.
        #[arg(long)]
        force: bool,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
enum Agent {
    Agents,
    ClaudeCode,
}

pub(crate) fn skill(args: SkillArgs) -> Result<(), Box<dyn std::error::Error>> {
    match args.action {
        Action::Print => {
            std::io::stdout().lock().write_all(SKILL.as_bytes())?;
            Ok(())
        }
        Action::Install {
            agent,
            project,
            dir,
            force,
        } => {
            let note_claude_code = dir.is_none() && agent == Agent::Agents;
            let folder = match dir {
                Some(dir) => dir,
                None => skills_folder(agent, project)?,
            };
            let path = install(&folder, force)?;
            println!("Installed the {NAME} skill at {}", path.display());
            if note_claude_code {
                println!("Claude Code reads .claude/skills instead: add --agent claude-code to install it there.");
            }
            Ok(())
        }
    }
}

/// `<base>/.agents/skills` or `<base>/.claude/skills`, where the base is the home folder or,
/// for `--project`, the top folder of the current git repository (or the current folder
/// when it is not in one). Claude Code's home folder can be moved with `CLAUDE_CONFIG_DIR`.
fn skills_folder(agent: Agent, project: bool) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let base = if project {
        let current = std::env::current_dir()?;
        super::repository::worktree_root(&current).unwrap_or(current)
    } else {
        std::env::home_dir().ok_or("the home folder is unknown; use --dir")?
    };
    Ok(match agent {
        Agent::Agents => base.join(".agents/skills"),
        Agent::ClaudeCode if !project => std::env::var_os("CLAUDE_CONFIG_DIR")
            .map(PathBuf::from)
            .filter(|path| path.is_absolute())
            .unwrap_or_else(|| base.join(".claude"))
            .join("skills"),
        Agent::ClaudeCode => base.join(".claude/skills"),
    })
}

/// Writes `<folder>/token-efficiency/SKILL.md`. A different existing file is kept unless
/// `force` is set, since the user may have edited it.
pub(super) fn install(folder: &Path, force: bool) -> Result<PathBuf, String> {
    let path = folder.join(NAME).join("SKILL.md");
    if let Ok(existing) = fs::read_to_string(&path) {
        if existing == SKILL {
            return Ok(path);
        }
        if !force {
            let path = path.display();
            return Err(format!(
                "{path} differs from this version's skill; use --force to replace it"
            ));
        }
    }
    let parent = path.parent().unwrap_or(folder);
    fs::create_dir_all(parent).map_err(|error| format!("{}: {error}", parent.display()))?;
    fs::write(&path, SKILL).map_err(|error| format!("{}: {error}", path.display()))?;
    Ok(path)
}
