# Changelog

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
