mod analysis;
mod api;
mod claude_code;
mod codex;
mod domain;
mod opencode;
mod pi;
mod pricing;
mod report;
mod server;
mod source;
mod vscode_copilot;

use clap::{CommandFactory, FromArgMatches, Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(
    version,
    about,
    override_usage = "highwater [COMMAND]",
    args_conflicts_with_subcommands = true
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
    /// `serve`'s options, which also work without the command. They are left out of this
    /// command's help, which documents them under `serve`.
    #[command(flatten)]
    serve: server::ServeArgs,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Start the local web viewer (the default when no command is given).
    Serve(server::ServeArgs),
    /// Summarise where sessions spent tokens, for finding ways to use fewer.
    Report(report::ReportArgs),
    /// Print the text of one context item from a session.
    Show(report::ShowArgs),
    /// Print or install the agent skill that uses `report` and `show`.
    Skill(report::SkillArgs),
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let command = Cli::command().mut_args(|arg| arg.hide(true));
    let cli = Cli::from_arg_matches(&command.get_matches()).unwrap_or_else(|error| error.exit());
    let serve = match cli.command {
        None => cli.serve,
        Some(Command::Serve(args)) => args,
        Some(Command::Report(args)) => return report::run(args),
        Some(Command::Show(args)) => return report::show(args),
        Some(Command::Skill(args)) => return report::skill(args),
    };
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?
        .block_on(server::run(serve))
}

#[cfg(test)]
mod tests {
    use super::{Cli, Command};
    use clap::Parser;

    fn parse(arguments: &[&str]) -> Result<Cli, clap::Error> {
        Cli::try_parse_from(std::iter::once("highwater").chain(arguments.iter().copied()))
    }

    #[test]
    fn serve_is_the_default_and_its_options_work_without_the_command() {
        let bare = parse(&[]).expect("no arguments");
        assert!(bare.command.is_none());
        assert_eq!(bare.serve.port, 43123);
        let options = parse(&["--port", "1", "--claude-root", "x"]).expect("serve options");
        assert!(options.command.is_none());
        assert_eq!(options.serve.port, 1);
        assert_eq!(options.serve.sources.claude_root.len(), 1);
        let serve = parse(&["serve", "--port", "2"]).expect("serve");
        assert!(matches!(serve.command, Some(Command::Serve(args)) if args.port == 2));
    }

    #[test]
    fn options_are_accepted_only_by_the_commands_that_use_them() {
        assert!(parse(&["report", "--claude-root", "x", "--last", "3"]).is_ok());
        assert!(parse(&["show", "session", "item", "--codex-home", "x"]).is_ok());
        assert!(parse(&["report", "--port", "1"]).is_err());
        assert!(parse(&["skill", "install", "--claude-root", "x"]).is_err());
        assert!(parse(&["--port", "1", "report"]).is_err());
    }
}
