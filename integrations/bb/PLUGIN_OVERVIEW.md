Open a Pi or Claude Code thread's right panel and choose **Context** from New tab. Inspect the session summary, Context River, Composition, individual calls and items, and context lifespans without leaving the conversation.

## Live context view

The view refreshes when the thread advances. Follow latest moves to new calls; pinning a call stops it. Updates to the same session preserve selections. An edited message or cleared context is resolved again. The view follows bb's light or dark theme, and hidden tabs pause requests.

## Compact summary

The Context row shows call and compaction counts, a small history chart and bb's current token usage. Select it to open the tab. Narrow panes show a segment above the composer instead. With only the row visible, the browser receives a small summary rather than the full analysis.

## Development requirements

This plugin is still in development. It currently needs a compatible Highwater binary on the agent machine's PATH, or an explicit path in the Highwater binary setting. Automatic binary provisioning is planned but not implemented. Codex is not supported yet.

Local macOS use is verified. Windows and remote access are not validated. Large sessions update less frequently because refreshes are limited by analysis time.

## Session content

The plugin runs a private Highwater process on the agent's machine. Analyses include previews of session content and travel through the bb server to your client. They are not sent to another service. No agent instructions, tools or skills are added.
