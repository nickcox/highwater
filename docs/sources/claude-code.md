# Claude Code sessions

How Highwater reads Claude Code CLI transcripts. For the rules that apply to every source, such as tokenization and cost, see [data semantics](../data-semantics.md).

Claude Code is not open source and its transcript format is not documented. The rules here come from transcripts written by versions 2.1.229 and 2.1.287 and from the synthetic fixtures in `fixtures/claude-code/`; other versions may record things differently.

## Where sessions are

Transcripts are under `$CLAUDE_CONFIG_DIR/projects` (default `~/.claude/projects`), which Highwater reads when it exists. `--claude-root` (repeatable) replaces that default, and an explicit `--session-root` on its own turns it off. Transcripts are read locally and never written; `~/.claude.json`, credentials and referenced files are never read.

- A main session is `<project>/<session UUID>.jsonl`. The project directory's name is the working directory with `/` replaced by `-`, but it can be out of date after a `relocated` record, so the working directory comes from the records' `cwd` instead.
- A subagent is `<project>/<session UUID>/subagents/agent-<agent ID>.jsonl`, with `agent-<agent ID>.meta.json` beside it holding `agentType`, `description` and `toolUseId` (the parent's tool call that started it). A subagent is listed as a child session of its parent, labelled with its type; its context is not merged into the parent's.
- A transcript with no assistant record, such as a session closed before its first prompt was sent, has nothing to chart and is not listed until its first response is recorded.
- The title is the latest `custom-title`, otherwise the latest `ai-title`. References are `claude-code-…`, a hash of the session ID (plus the agent ID for a subagent). The same session ID under two roots is rejected as ambiguous.
- The catalogue reads each transcript's listing fields again only when its size or modification time changes.

## Format

Each line is one JSON record with a `type`. Records with a `uuid` and `parentUuid` form a graph; the others hold session state.

| Type | In the graph | What it holds |
| --- | --- | --- |
| `user` | yes | User text (a string or blocks), `tool_result` blocks, the compaction summary (`isCompactSummary`), and command, hook or reminder text (`isMeta`). Tool results also carry `toolUseResult`, the tool's structured result for the terminal, which is not what the model was sent. |
| `assistant` | yes | One content block per record: `text`, `thinking` or `tool_use`, with `message.id`, `message.model`, `message.usage`, `message.stop_reason` and `requestId`. |
| `attachment` | yes | Context Claude Code adds to a request: environment, date, instructions, skill and agent listings, edited-file notices, token reminders and others. From 2.1.287 most have `rendered` (a list of `{content}` objects) and `renderedRole`; `queued_command` uses `renderedInHumanTurn`. In 2.1.229 none have rendered text. |
| `system` | yes | `turn_duration`, `away_summary`, `informational`, `local_command` and `compact_boundary`. Not model context. |
| `ai-title`, `custom-title` | no | Session titles, written many times; the latest applies. |
| `cost-state` | no | Claude Code's running session total: `totalCostUSD`, `startTime` and per-model usage. |
| `last-prompt`, `mode`, `permission-mode`, `queue-operation`, `file-history-snapshot`, `file-history-delta`, `relocated` and others | no | Interface and file-history state. Not used. |

Claude Code writes each content block of one API response as a separate `assistant` record. All records of a response share `message.id` and `requestId`, and usually repeat the same `usage`.

## Active branch

Duplicate UUIDs, cycles and missing parents fail the session. Then:

1. **Leaf.** The active branch ends at the last-written `user` or `assistant` record with no `user` or `assistant` children. `system` and `attachment` records are never the leaf, because an `away_summary` is often the newest record. A rewind leaves the abandoned branch out. `last-prompt.leafUuid` is not used: it does not always point at the last record.
2. **Walk.** `parentUuid` is followed from the leaf to the root.
3. **Compaction.** A `compact_boundary` has no parent; the walk continues from its `logicalParentUuid`. A boundary whose `logicalParentUuid` names a record written after it (seen in 2.1.287) is read as continuing from the record before the boundary, with the limitation `repairedCompactionLink`.
4. **Parallel tool results.** When one response has several tool calls, the second call's record and the first call's `tool_result` both have the first call's record as their parent, so the result is off the chain. A tool result that is not on the chain, whose `tool_use_id` matches a tool call in a response on the chain, is placed after the last record of that response, in file order. A tool result whose call is not on the branch belongs to another branch and is left out.

The rules are in `src/claude_code/branch.rs`, kept in one module so that a later way of showing several branches can replace it.

## Calls and context

- **Calls.** One model call per distinct `message.id` on the branch. Its records are merged in file order into one assistant item with several blocks, and its usage is taken from the last record (where records disagree, only `output_tokens` differs and the last is highest). A response's records can be interleaved with its own tool results and with a user message typed while it was being written; the assistant item is placed at the response's first record, and the records between join the next call's context.
- **Failed attempts.** `<synthetic>` records marked `isApiErrorMessage` are failed attempts with placeholder usage. Their text is an error shown in the terminal, not model output, so it is not context.

| Source | Item kind | Notes |
| --- | --- | --- |
| `user` with text, not `isMeta` | User message | Includes slash commands and their output (`<command-name>`, `<local-command-stdout>`) and task notifications. |
| `assistant` response | Assistant message | One item per response, not per record. |
| `user` with `tool_result` blocks | Tool result | One item per result, labelled from its tool call. Only `message.content` is counted, not `toolUseResult`. `is_error` marks a failed tool. A `tool_reference` block, which loads a tool's definition, is counted as `[tool reference: name]` with the note `unrecordedToolDefinition`. |
| `attachment` with rendered text | Custom message | Labelled from its type, for example **Environment**. |
| `attachment` without rendered text | – | Not context. If it is a type that 2.1.287 renders, the session gets `unrenderedAttachments`, because it was probably sent but its text is unknown. |
| `user` with `isMeta` | Custom message | Skill text, `<system-reminder>` blocks, command caveats and automatic continuation messages, all sent as user content. |
| `user` with `isCompactSummary` | Compaction summary | Starts the context after a compaction. |

## Compaction

A `compact_boundary` records `compactMetadata`: `trigger`, `preTokens`, `postTokens`, `preservedSegment` (`headUuid`, `anchorUuid`, `tailUuid`) and `preservedMessages`. The preserved records are the last ones before the boundary and keep their original parents in the file; only `preservedSegment` places them after the summary.

After the boundary, the context is the summary, then the conversation records of the preserved segment, which continue as retained items, then the records after the summary on the chain. Items before the boundary that are not preserved end at the last call before it and are drawn as the summary's sources. A boundary without `preservedSegment` keeps only the summary, with the limitation `unverifiedCompactionRetention`. The compaction's own model call is not recorded, so no call is created for it, and `missingCompactionUsage` is added.

## Coverage

Every analysis has `reconstruction: {status: "partial"}`, because the transcript does not contain the system prompt, the tool definitions (`missingHistoricalSystemPrompt`, `missingHistoricalToolDefinitions`), or Claude Code's own model calls such as titles, away summaries and the compaction call (`unrecordedHarnessCalls`). The system prompt and tools are measured instead as an **Unrecorded request context** item; see [Claude models](../data-semantics.md#claude-models). Other limitations are added when they occur: `missingCompactionUsage`, `unverifiedCompactionRetention`, `unrenderedAttachments`, `unsupportedContent` (for example `server_tool_use` blocks) and `repairedCompactionLink`.

## Usage, cost and timing

| Normalized field | Claude Code field |
| --- | --- |
| `input` | `input_tokens` (uncached input only) |
| `cache_read` | `cache_read_input_tokens` |
| `cache_write` | `cache_creation_input_tokens` |
| `cache_write_1h` | `cache_creation.ephemeral_1h_input_tokens` |
| `output`, `recorded_output` | `output_tokens`, which includes thinking |
| `reasoning` | `output_tokens_details.thinking_tokens` |

Missing fields stay empty, never zero. The model target is provider `anthropic`, the recorded model ID and API `anthropic-messages`. Cache figures use the `anthropic-messages-cache-v1` policy.

No cost is recorded per call. The transcript does not record whether a session used a Claude subscription or an API key, so `billing-modes.toml` treats Claude Code's `anthropic` calls as a subscription and prices them as `apiEquivalent` at Anthropic's API rate. That is also what an API key pays, so the amount is the same either way. When the transcript has a `cost-state` record, the latest one's `totalCostUSD` and `startTime` become `session.harnessSessionCost`: a running total that also includes subagents and Claude Code's own calls, so it is shown only in Session details and never added to other costs. Whether a resumed session continues that total or starts again from zero is not known.

Only the time each response was written is recorded, so `startedAtMs` is empty and duration and output rate are unavailable. The time since the previous record would include tool run time and waiting, so it is not used.

## Freshness and performance

Transcripts use the same size and modification-time fingerprint as Pi files, and an unfinished last line is skipped. The projects directory is watched, including subagent directories created during a session.

A synthetic 16.8 MB transcript (701 calls, 2,798 context items, one compaction) took about 0.5 s for a cold release-build analysis, 4 ms for a cached one and under 1 ms for a `304`, with about 126 MiB peak sampled server memory (`python3 scripts/benchmark-claude-code.py`).
