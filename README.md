# TokenPlume

TokenPlume is a local Context River visualizer for Pi JSONL, OpenCode SQLite, Claude Code CLI and VS Code Copilot Chat sessions. It reconstructs the active branch and historical model-call context, then lets you follow stable context items through their lifetimes and explicit compaction boundaries.

## Run

```bash
npm --prefix web ci
npm --prefix web run build
cargo run                                  # development and debugging
cargo run --release                        # large-session validation and normal fast use
# Pi-only:
cargo run --release -- --session-root ~/.pi/agent/sessions
# Explicit OpenCode databases (repeatable; may be combined with --session-root):
cargo run --release -- --opencode-db /path/to/opencode.db --opencode-db /path/to/opencode-stable.db
# Explicit Claude Code projects directories (repeatable; may be combined with the others):
cargo run --release -- --claude-root ~/.claude/projects
# Explicit VS Code user data folders, for Copilot Chat (repeatable):
cargo run --release -- --vscode-user-dir "$HOME/Library/Application Support/Code/User"
# Optional: --port 43123 --tokenization auto
```

Open the printed localhost URL. The server binds only to `127.0.0.1`, rejects requests that do not address it as `127.0.0.1` or `localhost` on its own port, and never modifies session files. Without source flags it discovers `~/.pi/agent/sessions`, OpenCode databases under `$XDG_DATA_HOME/opencode` (default `~/.local/share/opencode`) Claude Code transcripts under `$CLAUDE_CONFIG_DIR/projects` (default `~/.claude/projects`), and Copilot Chat sessions in VS Code's and VS Code Insiders' user data folders for the platform.

## Documentation

- [User guide](docs/user-guide.md): opening sessions, the Context River, Composition, lifespans, view links and the cache and cost track.
- [Data semantics](docs/data-semantics.md): tokenization, OpenCode, Claude Code and VS Code Copilot support, the analysis API, and how reported usage, local estimates and missing values are kept apart.
- [Architecture](docs/architecture.md): how the Rust server and Svelte frontend divide the work.
- [Development](docs/development.md): toolchain requirements, checks, browser tests and benchmarks.
- [Plans](plans/README.md): plans for future work, and an archive of completed plans and implementation notes.
- [Code review, October 2026](docs/reviews/2026-10-10-codebase-review/README.md).
