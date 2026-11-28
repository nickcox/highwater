# Copilot app and CLI sessions

How Highwater reads sessions written by the GitHub Copilot desktop app and the Copilot CLI. For the rules that apply to every source, such as tokenization and cost, see [data semantics](../data-semantics.md). Copilot Chat in VS Code writes a different format; see [VS Code Copilot Chat](vscode-copilot.md).

The session format is not documented, but the Copilot app includes TypeScript definitions of every event (`Contents/Resources/copilot-sdk/generated/session-events.d.ts` in the macOS app). The rules here come from those definitions, from three sessions written by the Copilot app 1.4.2 (agent version 1.0.106) in November 2026, and from the synthetic fixtures in `fixtures/copilot/`. Rules that the definitions describe but no session has shown yet are marked as untested.

## Where sessions are

The app and the CLI keep their data under `$COPILOT_HOME` (default `~/.copilot`), which Highwater reads when it has a `session-state` folder. `--copilot-home` (repeatable) replaces that default, and an explicit `--session-root` turns it off, as it does for the other sources.

- **Sessions:** `session-state/<session ID>/events.jsonl`, one folder per session. The app writes `client_name: github/autopilot` in the session's `workspace.yaml`, and the CLI `github/cli`; both are read the same way.
- **Titles and folders:** `workspace.yaml` beside the event log, a flat list of `key: value` lines. Highwater reads `id`, `cwd`, `name` (the title), `client_name` and `created_at`, and only from a regular file, not a symbolic link. A change to it, such as renaming the session, makes the analysis again.
- Only `session-state` is watched for changes; the rest of the folder holds databases and logs. A session with no call of the main agent (a usage record inside an assistant turn, as below) has nothing to chart and is not listed. Most of these are sessions the app opens for its own use. The CLI sessions surveyed (versions 1.0.64 to 1.0.91) record no usage either, so they are not listed. A session found in more than one home folder is listed once, from the copy changed most recently. References are `copilot-…`, a hash of the session ID.

The session table reads `data.context.branch` from `session.start` and `session.resume` during discovery, cached by file stamp. Resume events can record a newer branch, so discovery scans through the file. It shows the last recorded branch other than `HEAD`, with every distinct branch in first-use order in the tooltip. A resume with no branch does not erase an earlier recorded branch.

## Format

Each line is one JSON event, `{type, data, id, timestamp, parentId}`. An unfinished last line is skipped. Events from a subagent also carry `agentId`, and events that repeat earlier history for a replay checkpoint carry `checkpoint: true`; neither is part of the main agent's conversation.

| `type` | What it holds | Used |
| --- | --- | --- |
| `session.start`, `session.resume` | The session ID, `copilotVersion`, `selectedModel` and the working directory. | Yes |
| `session.model_change` | `newModel`, the model for later calls. | Yes |
| `system.message` | The full system prompt, written before the first call. | Yes |
| `user.message` | `content`, the text the user typed, and `transformedContent`, the text sent to the model (with the date and attached context). | Yes |
| `assistant.turn_start`, `assistant.turn_end` | One model call each. `turnId` counts calls within a request. | Yes |
| `session.usage_record` | The call's usage, in `data.usage` (the `AssistantUsageData` definition): tokens, the charge, the API endpoint, `duration` and `finishReason`. | Yes |
| `assistant.message` | The response: `content`, `toolRequests`, and encrypted reasoning (`reasoningOpaque`, `encryptedContent`). | Yes |
| `tool.execution_start`, `tool.execution_complete` | A tool call's name and arguments, then its result or error. | Yes |
| `skill.invoked`, `skill.context_delivered_ref` | A skill's text, then the message that delivers it to the model. | Yes |
| `system.notification` | A message Copilot adds to the conversation. | Yes |
| `session.compaction_start`, `session.compaction_complete` | A compaction starting, and its summary, counts, details and own call's usage when it is applied. | Yes |
| `session.truncation`, `session.context_cleared` | Other changes to the conversation. | Yes (untested) |
| `session.usage_checkpoint` | Copilot's running usage total. | Yes |
| `hook.start`, `hook.end`, `session.shutdown` and the rest | Hooks and the app's display. | No |

## Reading sessions

- **Calls.** Each `assistant.turn_start` to `assistant.turn_end` is one model call, with the items in context when it starts. Its usage record comes first, then its message, and both carry the same `apiCallId`. A usage record outside a turn is not a call of the conversation (`unrecordedHarnessCalls`).
- **Usage.** `inputTokens` is the whole input, including cache reads and writes, so input is `inputTokens` less `cacheReadTokens` and `cacheWriteTokens`. Output is `outputTokens`, which includes reasoning for the Responses API. The provider is `github-copilot`, the model the record's `responseModel`, and the API comes from `apiEndpoint`: `/responses` is `openai-responses`, `/v1/messages` is `anthropic-messages` and `/chat/completions` is `openai-completions`.
- **Cost.** `copilotUsage.totalNanoAiu` is what Copilot charged for the call, in billionths of a credit. As for VS Code Copilot, a credit is valued at $0.01. `copilotUsage.tokenDetails` records each input, cache-read, cache-write and output charge: `tokenCount × costPerBatch / batchSize` nano-AIU. Highwater converts these at the same credit value into recorded component costs, including for `compactionTokensUsed`. When token details are absent the component costs are unknown; a kind omitted from a recorded detail list contributes zero. Invalid counts or rates and non-positive batch sizes leave that kind unknown.
- **Timing.** `duration` runs from sending the request to the end of the response, so the call's start is its usage record's time less `duration`. A call without a `duration` has no start time, so no response time is shown.
- **System prompt.** `system.message` is a recorded item. A later one with the same text is the same item; one with different text replaces it.
- **Tool definitions.** Each usage record gives the tool definitions' size (`toolTokenCount`) but not the definitions (`missingHistoricalToolDefinitions`), so an **Unrecorded request context** item is measured for them, as for Codex.
- **Tool calls and results.** A response's text and tool calls are one assistant item. Results are matched to their call by `toolCallId`. A result with `success: false` is marked as failed, and its text is the error message. Results are labelled from their call: `bash` with its command, `view`, `edit` and `create` with their path, `apply_patch` with its first file, and `skill` with the skill's name.
- **Skills.** Loading a skill returns a short tool result, and the skill's text is sent as a message of its own: `skill.context_delivered_ref`'s `prefix`, the latest `skill.invoked` text for that skill, and its `suffix`. That message is a custom item labelled **Skill · name**.
- **Reasoning.** Reasoning is recorded only in encrypted form, so a response's reasoning is a Thinking item sized by its usage record's `reasoningTokens`, and stays in the context with its response. Responses that report reasoning tokens but record no encrypted reasoning have no Thinking item.
- **Compaction.** A compaction can run in the background: `session.compaction_start` is written when it starts, later calls go on adding to the context, and `session.compaction_complete` (with `success: true` and the same `compactionAttemptId`) is written when it is applied. It keeps the last `preCompactionMessagesLength` less `messagesRemoved` messages of the context it started from, and everything added while it ran, and replaces the rest with its `summaryContent`, a **Compaction summary** item at the front of the conversation. The kept messages are counted back from where it started, because Copilot counts messages slightly differently (163 against Highwater's 156 in the surveyed compaction). Without the two counts only the summary is kept (`unverifiedCompactionRetention`). Its rule is `keptLastMessages`, or `summaryOnly` without the counts.
- **Compaction details.** The compaction's details come from `session.compaction_complete`: the trigger (`manual`, or automatic for `threshold`, `context_limit_retry`, `memory_pressure` and `model_switch`) and `customInstructions` for a manual one; the call it started before, for a background compaction; `summarizerProgress.durationMs`; Copilot's message counts before, removed and kept, and the number of messages added while it ran; and `preCompactionTokens`, `postCompactionTokens`, and the system, tool-definition and conversation tokens after it.
- **Compaction calls.** `compactionTokensUsed` is the usage and charge of the compaction's own call. It becomes a call before the compaction, with the stop reason `compaction-call` (`compaction-aggregate` when `requestCount` is more than 1), the API of an earlier call to the same model, and the context as it was when the compaction started, because that is what it summarised: in the surveyed compaction, its calculated context was 0.8% below its reported input, as for the calls around it. It is added when the compaction is applied, so a background compaction's call comes after the calls made while it ran, although it started before them. Without `compactionTokensUsed` the call is not shown (`missingCompactionUsage`).
- **Truncation and clearing (untested).** `session.truncation` removes the oldest `messagesRemovedDuringTruncation` messages, and `session.context_cleared` removes them all, without a summary.
- **Subagents.** A subagent's events are written to the main session's file with its `agentId`. They are left out (`subagentCallsNotShown`).

**Session cost.** Session details shows Copilot's own total from the last valid `session.usage_checkpoint`, at $0.01 per credit. It is separate from the sum of recorded call costs, which already includes compaction calls when their usage is recorded. A live session can have calls newer than its last checkpoint.

## Accuracy

With the system prompt and the skills' text recorded, almost all of each call's input is in the file. Over the 85 calls of the three surveyed sessions, which include one background compaction, the calculated context is a median of 1.0% below the reported input, and never more than 3.1% below it. The calls after the compaction are less than 1% below. Most of the difference starts at the call after a skill is loaded: the input grows by a few hundred tokens more than the skill message accounts for, for a reason not yet found.

## Not supported

- **Subagents.** Their calls are left out rather than shown as child sessions.
- **Truncation and clearing.** These follow the event definitions but have not been checked against a real session, so the messages they remove may be wrong.
- **Calls with Claude models.** None of the surveyed sessions used one, so how their usage and reasoning are recorded has not been checked.
- **Failed and cancelled calls.** `model.call_failure` and `abort` events are not shown as calls.
- **Image results from tools.** `binaryResultsForLlm` is not counted (`unsupportedContent`).

The catalogue takes the first main-agent user-message event’s content.

The session table's **Model**, **Calls** and **Peak input** come from loading each session file in full in the background.
