# VS Code Copilot Chat sessions

How Highwater reads GitHub Copilot Chat sessions from VS Code. For the rules that apply to every source, such as tokenization and cost, see [data semantics](../data-semantics.md).

Copilot Chat's formats are not documented. The rules here come from sessions written by Copilot Chat 0.41 to 0.69 and from the synthetic fixtures in `fixtures/vscode-copilot/`.

## Where sessions are

Without explicit source flags, Highwater reads VS Code's and VS Code Insiders' user data folders for the platform when they exist: `~/Library/Application Support/Code/User` on macOS, `%APPDATA%\Code\User` on Windows and `$XDG_CONFIG_HOME/Code/User` elsewhere (`Code - Insiders` for Insiders). `--vscode-user-dir` (repeatable) replaces those defaults; an explicit `--session-root` on its own turns them off. Session files and the trace database are read locally and never written.

| Store | Path under the user data folder | Used for |
| --- | --- | --- |
| Session files | `workspaceStorage/<workspace>/chatSessions/<session id>.jsonl` | One file per chat session, kept until the user deletes the chat. |
| Sessions with no folder open | `globalStorage/emptyWindowChatSessions/<session id>.jsonl` | The same format. |
| Workspace folder | `workspaceStorage/<workspace>/workspace.json` | The session's working directory. A `file://` URI becomes a path; a `vscode-remote://` URI is kept as recorded, because the folder is on another machine. |
| Trace database | `globalStorage/github.copilot-chat/agent-traces.db` (with `-wal` and `-shm`) | Per-call usage, timing and content, for about the last five days. |

Only sessions with at least one request are listed; most session files are empty. The title is the custom title, otherwise the first message. References are `vscode-copilot-…`, derived from the session ID.

## Session file format

A session file is a log of changes to one JSON value, one change per line. Replaying the lines in order gives the session:

| `kind` | Meaning |
| --- | --- |
| 0 | The starting state of the whole session (`v`). Always the first line. |
| 1 | Set the value at path `k` (a list of keys and array indexes) to `v`. |
| 2 | Append the items in `v` to the array at path `k`. When `i` is present, first remove the array's items from index `i` onwards. |
| 3 | Delete the value at path `k`. |

A file whose first line is not `kind` 0, or with a line that cannot be applied, is reported as a structure error. The replayed session has `sessionId`, `creationDate`, an optional `customTitle` and `requests`, one per user request. The fields Highwater uses on a request:

- `requestId`, `timestamp`, `message` (the user's text) and `modelId` (the model the user picked; `copilot/auto` is not a model).
- `result.metadata`:
  - `responseId`, which links the request to its trace records, and `resolvedModel` in older versions.
  - `toolCallRounds`: one entry per model call, in order, with `id`, `modelId`, `timestamp`, `thinking`, `response` and `toolCalls`.
  - `toolCallResults`: each tool call's full result, keyed by tool-call ID. A result recorded as a rendered prompt tree (`{"node": …}`) is converted to its text.
  - `renderedUserMessage` (the message as sent, with attachments) and `renderedGlobalContext` (workspace context added to the first request).
  - `promptTokens` and `outputTokens` in newer versions.
- `promptTokens`, `completionTokens` and `copilotCredits` at the top level on some newer requests. Version 0.41 records no token counts at all.

Tool-call IDs in the session file have a `__vscode-<number>` suffix that the trace records do not; matching compares the part before the suffix.

## Trace database

The trace database records OpenTelemetry generative-AI spans in `spans`, with extra key–value pairs in `span_attributes`. Every record for a chat has `chat_session_id`, which equals the session file's name.

| `operation_name` | `agent_name` | One per | Used |
| --- | --- | --- | --- |
| `chat` | `panel/editAgent` | Model call | Yes |
| `chat` | `retry-error-panel/editAgent` | Model call retried after an error | Yes, labelled as a retry |
| `execute_tool` | – | Tool call | Yes: `tool_call_id` and the result |
| `invoke_agent` | `GitHub Copilot Chat` | User request | No: its totals are the sums of its calls' |
| `chat` | `summarizeVirtualTools`, `title`, `progressMessages` and others | Copilot's own helper calls | No: not part of the conversation |

A model call's attributes include `gen_ai.usage.input_tokens` (the total input, including cache reads and writes), `gen_ai.usage.output_tokens`, `gen_ai.usage.cache_read.input_tokens`, `gen_ai.usage.cache_creation.input_tokens` (Claude only), `gen_ai.usage.reasoning_tokens`, `copilot_chat.copilot_usage_nano_aiu` (the charge in billionths of a credit), `gen_ai.response.id`, `gen_ai.input.messages`, `gen_ai.system_instructions`, `gen_ai.tool.definitions` and `copilot_chat.request.shape`.

What a call's input contains depends on the API Copilot used. For Anthropic models (`"api":"messages"`) every call records the full conversation, system instructions and tool definitions. For OpenAI models (`"api":"responses"`) Copilot continues the previous response on the server and records only the new items, so a call's context is the previous call's context plus its output plus the new input.

The stores link like this:

```
session file (chatSessions/<id>.jsonl)          trace database
  requests[n]                                     invoke_agent      chat_session_id = <id>
    result.metadata.responseId  ───────────────►    chat records    gen_ai.response.id
    result.metadata.toolCallRounds[k]  ────────►    k-th chat record of that request (by start time)
      toolCalls[j].id (before "__vscode-")  ───►    execute_tool    tool_call_id
```

## Calls and context

- **Calls.** Each round in `toolCallRounds` is a model call. A request with no rounds (older versions, or one still running) is one call. A request cancelled or failed before any response is left out. A request that was stopped can record no rounds although its response shows several tool calls; it is shown as one call without output, with the `unrecordedRounds` note, unless trace records can split it.
- **Model.** The round's `modelId`, otherwise `resolvedModel`, otherwise the request's `modelId` without the `copilot/` prefix. When only `copilot/auto` is recorded, the model is unknown.
- **Context items.** The user message as sent (`renderedUserMessage`, otherwise `message.text`), the workspace context on the first request, each round's response with its tool calls, each round's thinking (sized by the reasoning tokens Copilot records with it, because OpenAI models' thinking is stored encrypted) and each tool result. A round's context is everything before it in the session.
- **Usage from the session file.** A request's `promptTokens` is its last call's input, recorded as a total because the cached part is not known. `outputTokens` or `completionTokens` is the request's total output, so it is a call's own only when the request made one call. The system prompt and tool definitions are not in the session file, so they are measured as an **Unrecorded request context** item; see [Claude models](../data-semantics.md#claude-models).

## What trace records add

While a request's trace records exist, they are matched to its rounds by `responseId` and, in start-time order, checked against the tool-call IDs. When the counts or IDs disagree, the request uses the session file alone and the session gets `traceRecordsIncomplete`, which also marks a session in which some calls have no trace record. A trace database that cannot be read gives `traceRecordsUnreadable`. A matched call gets:

- **Usage.** Uncached input is the total input less cache reads and cache writes. Output includes reasoning.
- **Timing.** The span runs from sending the request to the end of the response, giving a duration and output rate with the basis `vscode-copilot-trace-spans`.
- **System prompt and tool definitions** in place of Unrecorded request context, one item per distinct text, so a change becomes a new version. A Responses API call that continues an earlier response keeps the latest system prompt recorded for its model. For Claude, Copilot sends in full only the tools up to and including `tool_search`; the rest are loaded on demand, so they are not counted.
- **Tool results as sent.** Copilot can shorten a long result before sending it, so the text from a later call's input replaces the session file's.
- **Compaction.** Copilot can replace older conversation with a `<conversation-summary>` in a call's input, which the session file does not record. A call whose input has a new summary has a compaction before it: the summary becomes a Compaction summary item, the workspace context and the responses and tool results the input still includes are kept, and other conversation items are dropped.
- **Stopped requests.** A request with no rounds and no `responseId` takes the unclaimed trace calls between its timestamp and the next request's, each as a call.

## Coverage

Always partial: Copilot's own model calls (titles, progress messages, tool grouping) are not recorded. Without trace records, the system prompt and tool definitions are not recorded either. `unrenderedAttachments` marks a request recorded without the message as sent.

## Cost and cache figures

Copilot records what it charged, in credits: per traced call (`copilot_usage_nano_aiu`) and per request in the session file (`copilotCredits`, the sum of its calls'). A credit's dollar value is not recorded; at $0.01 a credit, the value assumed here, Claude calls' credits equal their price at the `github-copilot` rates exactly, and GPT calls' were 1–25% above. A traced call's credits, or a single-call request's, are its recorded cost; since `github-copilot` is billed per token from June 2026, that is the call's cost. Other calls are priced from the price table. The session's credits are Copilot's own total (`session.harnessSessionCost`), shown in Session details when it differs from the recorded call costs, which happens when some calls' trace records are gone.

Cache figures are usage-only, as for Claude Code. Claude calls use the `github-copilot-messages-cache-v1` policy and GPT calls `github-copilot-responses-cache-v1`; calls with no recorded API are unsupported.

## Freshness

A session's analysis is identified by the session file's size and modification time plus a fingerprint of the trace database and its `-wal` file, so an open session refreshes when records are added or deleted. `workspaceStorage` and `emptyWindowChatSessions` are watched.
