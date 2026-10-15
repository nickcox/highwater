# Changelog

## 0.1.0 – unreleased

The first release.

- Reads Pi JSON Lines sessions, OpenCode SQLite databases, Claude Code CLI transcripts (including subagents) and VS Code Copilot Chat sessions with their trace records.
- Context River: each context item's estimated size at every model call, with compactions, versions of the system prompt and tool definitions, the input each call reported, zoom, pan and keyboard navigation.
- Composition at one call or across the session, as a treemap or a ranked list.
- Context lifespans, searchable and filterable.
- Cache and cost track, with each call's recorded cost, an estimate from bundled models.dev price data, or an API-equivalent cost for calls covered by a subscription.
- Live updates while a session is being written, and shareable view links.
- Local token counting with OpenAI tokenizers, reconstructed Claude tokenizers and a character estimate.
- Prebuilt binaries for macOS, Linux and Windows, and installs with Nix or Cargo.
