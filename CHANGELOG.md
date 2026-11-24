# Changelog

## Unreleased

- The Call inspector shows a **Turn** section for Claude Code sessions run through the Agent SDK, as in BB, which do not record their turns. As for Pi, Highwater groups the calls between user messages and estimates each turn's elapsed time from its timestamps.

## 0.5.6 – 2026-11-24

- In a context item's **Content preview**, **Show more** loads up to 8 KiB of the item's recorded text, and **Load more** adds the next page of a longer item.
- The Call inspector shows a **Turn** section for Pi turns too, with the user prompt, recorded call counts, the pinned call's position in the turn and an estimate of the turn's elapsed time.
- A Codex fork shows a **Forked from** link to the session it was forked from.
- Claude Code, Codex, Copilot, VS Code Copilot and Pi sessions keep a compaction's marker and details when no later call reads its summary, such as a compaction replaced by another one or one at the end of the session. Before, the River left these compactions out.
- `highwater report` recognises each harness's own shell and file-reading tools. A tool that takes a command but is not the harness's shell tool, such as Claude Code's Monitor, no longer counts as a shell command, and Copilot's view tool is compared by the path it read.
- In narrow windows, the vertical scale and display controls stay above the chart instead of moving into a **View** menu. Zoom, **Fit all**, **Latest** and **Go to call** are under **Zoom & jump** (previously **More**) only until they fit on one row.
- The BB plugin uses a Highwater executable on the agent machine's PATH when it is the plugin's version or newer, and downloads the pinned release only when there is none.
- In BB, **Follow latest** shows a green dot when the Context tab is up to date and an amber dot while it updates, the context summary above the composer shows the Highwater gauge icon, and the Context tab fills the side panel's height.

## 0.5.5 – 2026-11-21

- Find Pi sessions in BB's current provider directory. Threads with transcripts in the legacy directory still open.
- Use BB's side-pane background in the Highwater Context tab.

## 0.5.4 – 2026-11-21

- The BB status bar shows the latest recorded call's estimated input by item type beside BB's context-window usage percentage. Hover or focus to see percentage shares and token counts. Turn off **Show context summary** in Highwater's plugin settings to hide the summary in both layouts.
- Highwater labels instructions, environment details and other context supplied by the coding agent or its extensions as **Agent-added context**.
- The Call inspector shows a **Turn** section for recognised Codex, Claude Code and VS Code Copilot turns, with whole-turn elapsed time where available, recorded call counts and the pinned call’s position in the turn.
- VS Code Copilot sessions explain when trace coverage is missing, partial or unreadable, and which details are unavailable as a result.
- The session picker shows costs in the background as they become available. Codex shows an estimated API-equivalent cost instead of a recorded charge. Sessions without a cost are labelled **Cost unknown**.
- `highwater report` gives each session's compaction calls and their cost (`compactionCalls`), and its cache-miss finding no longer counts a compaction's own call as a miss.
- Selecting a compaction's summary shows how the harness decided what to keep and what it recorded about the compaction: what started it, when, how long it took, what it removed and kept, and its own call. The events lane's compaction marker opens the same details, and a dashed line shows the calls a background compaction ran over.
- The call that writes a compaction summary is shown and counted in costs for Pi, Copilot, and Codex 0.167 and later, which record it. Before, those sessions' totals left it out. In the call details, a compaction call says what it is.
- Highwater reads sessions from the GitHub Copilot desktop app and the Copilot CLI, found in `$COPILOT_HOME` (default `~/.copilot`) or the folders given with `--copilot-home`. Each call shows its usage, what Copilot charged for it and how long it took. Compactions, including those Copilot runs in the background, keep the messages Copilot kept. Session details shows Copilot's own running total at its last usage checkpoint. Subagents' calls are not shown yet.

## 0.5.3 – 2026-11-17

- Claude Code sessions compacted with `/compact` in Claude Code 2.1.304 open again. Their compaction marker points to a record that is not in the transcript, which made Highwater report "source session is invalid"; the conversation now continues from the record before the marker, with a notice.
- A tidier header: the title with the theme choice at the right, then the harness and session menus with **Child sessions** on their own row, then the status line. The menus' labels are read out to screen readers but no longer shown, and Light, Dark and Auto are three small icons (sun, moon and half-filled circle).

## 0.5.2 – 2026-11-16

- In a window 760 pixels wide or less, the viewer shows the session summary on one line. At 520 pixels or less it also keeps less-used chart controls in **More** and **View** menus, so the chart starts higher up, opens Composition in **List**, and gives Context lifespans full-width labels and a **Filter and sort** menu.
- Context lifespans shows 50 items at a time instead of 200.
- Chart help has a close button, and closes on Escape or a click outside it.
- The chart's legends stay in view when a zoomed chart is scrolled, instead of scrolling away with the first call.
- The viewer has Light, Dark and Auto themes, chosen above the session picker and remembered between visits. Auto follows the system setting. Chart colours are adjusted for each theme, and each item keeps its colour when the theme changes.
- Add an optional bb plugin with a live Context tab and compact summary for Pi, Claude Code and Codex threads. It reuses the standalone session view, follows bb's theme, and preserves selections across updates to the same session. A Latest call panel above the chart summarises the newest call: its input and change since the previous call, cost, added and dropped items, tools and largest items in context.
- Provision a pinned Highwater binary automatically on the agent machine, verifying archive and executable checksums before use. Cache it privately for offline use, and allow an explicit binary override. Plugin releases are tagged `bb-plugin-vX.Y.Z` and use the Highwater binary of the same version. Analyses travel through the user's bb server to their client.

## 0.5.1 – 2026-11-09

- Each entry in the session picker shows when its session last changed, which is the order the list is sorted in. Before, it showed when the session started, so the dates looked out of order.

## 0.5.0 – 2026-10-31

- `highwater report` has four new findings:
  - `cacheMiss`: calls that read much less from the cache than the call before, outside a compaction, and whether each followed a pause longer than the cache lifetime.
  - `repeatedResultInContext`: tool results of at least 1,000 tokens that are identical to an earlier result still in context, such as a file read again before it was edited.
  - `largeUnlimitedOutput`: shell commands such as `cat`, `git diff` and `rg`, and search tools, that returned at least 5,000 tokens without limiting their output, in each session and across sessions.
  - `fixedOverhead`: for each harness, how large its sessions' prompts are before any work, what the system prompt, tool definitions and the harness's own messages cost as a share of input and of all cost, and their most expensive parts, with how often each defined tool was used.
- The `token-efficiency` skill explains the new findings and what to suggest for each.
- `repeatedCommand` findings count runs whose result is identical to an earlier run's. Before, results from different calls never matched, so the count was always 0.
- Codex tool results are marked as failed when Codex's output header says the command exited with a code other than 0, the script failed or the user stopped it. Before, no Codex result was counted as failed.
- Report JSON token subtotals keep unavailable values as `null`, include total-only prompt input and give coverage for each field. Average context uses only calls with complete recorded prompt totals, keeps a measured zero and gives its contributing-call count in the `carriedContext` finding. Text reports say when an average leaves out calls.

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
