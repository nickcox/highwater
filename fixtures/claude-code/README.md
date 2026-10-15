# Claude Code fixtures

Synthetic Claude Code transcripts and the results TokenPlume is expected to produce from them. They contain no real session content. The rules they test are in [docs/sources/claude-code.md](../../docs/sources/claude-code.md).

## Layout

`projects/` is laid out like `~/.claude/projects`, so it can be used as a `--claude-root` in tests:

- `projects/-synthetic-project/*.jsonl` – main sessions.
- `projects/-synthetic-project/subagent-parent/subagents/agent-a16.jsonl` and its `.meta.json` – a subagent of `subagent-parent.jsonl`.
- `projects/-synthetic-project/subagent-parent/other/ignored.jsonl` – a `.jsonl` file in a place discovery must ignore.
- `projects/-synthetic-old-location/relocated.jsonl` – a session whose directory name no longer matches its working directory.

Records keep the fields Claude Code writes (`parentUuid`, `isSidechain`, `cwd`, `sessionId`, `version`, `timestamp` and so on), but record UUIDs are short readable strings such as `s3-a2` (session 3, assistant record 2). Session IDs are UUID-shaped, with the fixture number in the first 8 characters. The files are edited by hand.

| Fixture | What it tests |
| --- | --- |
| `simple` | One call; title records (a custom title wins over a later AI title); state records without `uuid`; a `system` record after the leaf. |
| `split-response` | One response written as several records; usage that differs between records of one response; a user message typed while a response was being written. |
| `parallel-tools` | Parallel tool calls in both patterns (a result off the chain, and a result between records of the response); a failed tool. |
| `parallel-last` | An off-chain tool result that is the last record in the file, which must not be chosen as the leaf; `output_tokens_details: null`. |
| `rewind` | Two branches from one parent, where the abandoned branch has a tool call; an `away_summary` as the newest record. |
| `compaction` | A compaction with a preserved segment, re-added attachments and a `system` record after the summary. |
| `compaction-legacy` | A 2.1.229 compaction without a preserved segment. |
| `attachments` | Attachments with `rendered` and `renderedInHumanTurn`, a bookkeeping attachment without either, `isMeta` skill text and command caveat, a slash command and its output, a model change. |
| `attachments-unrendered` | A 2.1.229 attachment of a type that 2.1.287 renders. |
| `api-error` | A `<synthetic>` API error record followed by a retry. |
| `content-kinds` | A user image, a `tool_reference` tool result, a tool result with text and an image, a `server_tool_use` block. |
| `unfinished-line` | A last line that is still being written (no newline, not valid JSON). |
| `relocated` | A `relocated` record; the working directory comes from `cwd`, not the directory name. |
| `cost-state` | Claude Code's own total written as a running total, with repeated records. |
| `cost-state-restarted` | Two `cost-state` records with different start times. |
| `thinking-retention` | A model that keeps thinking only for the current turn (Sonnet 4.5): the thinking item is in context during the tool loop and leaves at the next user message. `split-response` covers a model that keeps it (Opus 5.5). |
| `subagent-parent`, `subagent` | A parent session whose `Agent` tool call started a subagent, and the subagent's own transcript. |

## Expected results

`expected/<name>.json` holds the results for one fixture. They were written by hand from the plan's rules, before any code that produces them, and are not generated from the fixtures.

| Field | Meaning |
| --- | --- |
| `fixture` | Path under `projects/`. |
| `sessionId` | The `sessionId` in the file. |
| `listing` | Catalogue entry: `kind` (`main` or `subagent`), `title`, `workingDirectory`, `parentFixture` (the parent's fixture for a subagent), and for subagents `subagent` (`agentId`, `agentType`, `parentToolUseId`). |
| `branch` | UUIDs of the records on the active branch, in order, including `system` records on the chain and the `compact_boundary`. |
| `calls` | One entry per model call, in order. Items that are in no call's context (such as the last response of a session) are not context items, as for Pi. Each entry has `message` (the `message.id`), `model`, `failed`, `usage` (`null` for a failed attempt, whose counters are placeholders), `context` (the items in the call's context, in order) and `toolCallsAfter` (the tool calls the response made). |
| `compactions` | `beforeCall` (the first call after the compaction), `tokensBefore`, `summary`, `retained` (items carried across the compaction) and `sources` (items before the boundary that are not retained and were in at least one call's context, as for Pi). |
| `limitations` | The coverage codes the analysis must report, in any order. |
| `ownCostTotal` | Claude Code's own session total (`totalUsd`, `startTimeMs`), or `null`. |

Items are named by kind and the identifier they come from:

| Key | Item |
| --- | --- |
| `user:<uuid>` | A user message, including slash commands and their output. |
| `meta:<uuid>` | An `isMeta` user record. |
| `assistant:<message.id>` | One response, however many records it was written as. |
| `tool:<tool_use_id>` | One tool result. |
| `attachment:<uuid>` | An attachment with rendered text. |
| `summary:<uuid>` | A compaction summary. |
| `thinking:<message.id>` | A response's thinking, sized by its reported reasoning tokens. |

`expected/discovery.json` lists which files discovery must return as main sessions and as subagents, and which it must ignore, when `projects/` is the root.
