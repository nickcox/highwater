# Changelog

## 0.4.0 – 2026-10-19

- `highwater report` summarises where recent sessions spent tokens, as text or JSON, without starting the viewer: each session's usage and cost, what made up its context, its most expensive tools and shell commands by program, how much of its input went on conversation from several user turns earlier, large tool results that stayed in context for many calls, commands run repeatedly within a session or across sessions, and commands run again after a compaction removed their results. By default it covers the 10 most recent sessions in the current directory's git repository and its worktrees. The JSON format (`--json`) is new and may still change in 0.4 releases.
- `highwater show` prints one item from a session, such as a tool result a report points to.
- `highwater skill print` and `highwater skill install` provide the `token-efficiency` agent skill, which runs the report and suggests ways to spend fewer tokens. `skill install` writes it to `~/.agents/skills` by default, to `~/.claude/skills` with `--agent claude-code`, or to the current repository's folder with `--project`.
- The viewer is now the `highwater serve` command. It is the default, so `highwater` on its own, or with the viewer's options, works as before. `highwater --help` lists the commands, and `highwater serve --help` the viewer's options.
- A Pi session made with `/fork` or `/clone` no longer counts its parent's calls, usage and compactions as its own. The history it copied from the parent is the context of its first call.

## 0.3.0 – 2026-10-18

- Reads OpenAI Codex sessions from `$CODEX_HOME` (default `~/.codex`), or the folders given with `--codex-home`, including archived and zstd-compressed session files, with titles from Codex's session index. Guardian reviews and spawned subagents are listed as child sessions.
- Codex calls take their usage from Codex's token counts, with cached input separated. The system prompt and the Codex app's tools are shown as recorded items; encrypted reasoning is sized by its reported tokens and kept across turns for GPT-5.6 and later models. Compactions show what Codex kept and an encrypted summary. Forked and spawned threads start with their parent's history as context, without repeating the parent's calls.
- A Codex response that ran web searches reports the usage of several requests together, so its input is not compared with its context, and the search results it keeps are measured as Unrecorded request context.
- Where a Codex thread was given little of its parent's history, or its context was reset without a compaction record, Highwater infers the boundary from the reported input and says so in the coverage note.
- Codex calls are priced at the API-equivalent rate, as Claude Code's are.

## 0.2.0 – 2026-10-17

- Child sessions (OpenCode child sessions and Claude Code subagents) are linked to their parents. The session picker leaves them out unless **Child sessions** is ticked, and then lists each one under the session that started it. A session's summary lists its child sessions, a child session links back to the tool call in its parent that started it, and that tool call's result links to the child session.
- In the River's Items view, bands next to each other no longer share a colour while one of the ten colours is free. Items view, Composition and Context lifespans give each item the same colour.
- An item that takes the place of an earlier one keeps that item's colour and place in the River: a new version of a system prompt or tool definition, the Unrecorded request context measured again after a compaction or a change of model, and an attachment Claude Code sends again after a compaction.
- Items removed by a compaction are described as removed at the compaction, and the summary as replacing them, instead of "structurally replaced".
- The startup line gives the number of sessions found for each harness, and how many of them are child sessions.
- The README lists Homebrew as a way to install.

## 0.1.0 – 2026-10-16

The first release.

- Reads Pi JSON Lines sessions, OpenCode SQLite databases, Claude Code CLI transcripts (including subagents) and VS Code Copilot Chat sessions with their trace records.
- Context River: each context item's estimated size at every model call, with compactions, versions of the system prompt and tool definitions, the input each call reported, zoom, pan and keyboard navigation.
- Composition at one call or across the session, as a treemap or a ranked list.
- Context lifespans, searchable and filterable.
- Cache and cost track, with each call's recorded cost, an estimate from bundled models.dev price data, or an API-equivalent cost for calls covered by a subscription.
- Live updates while a session is being written, and shareable view links.
- Local token counting with OpenAI tokenizers, reconstructed Claude tokenizers and a character estimate.
- Prebuilt binaries for macOS, Linux and Windows, and installs with Nix or Cargo.
