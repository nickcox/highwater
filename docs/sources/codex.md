# Codex sessions

How Highwater reads [OpenAI Codex](https://github.com/openai/codex) session files. For the rules that apply to every source, such as tokenization and cost, see [data semantics](../data-semantics.md).

Codex's session format is not documented. The rules here come from 326 local session files written by Codex 0.136 to 0.162 between June and October 2026, almost all by the Codex desktop app (`originator` is `Codex Desktop` or `codex_work_desktop`), and from the synthetic fixtures in `fixtures/codex`.

## Where sessions are

Codex keeps its data under `$CODEX_HOME` (default `~/.codex`), which Highwater reads when it exists. `--codex-home` (repeatable) replaces that default, and an explicit `--session-root` turns it off, as it does for the other sources.

- **Sessions:** `sessions/<year>/<month>/<day>/rollout-<start time>-<thread ID>.jsonl`. Finished sessions are usually compressed with zstd as `.jsonl.zst` (306 of 312 in the survey). Highwater decompresses them with the pure-Rust `ruzstd` decoder, frame by frame.
- **Archived sessions:** `archived_sessions/`, with the same file names in one folder.
- **Titles:** the last line for a thread in `session_index.jsonl` (`id`, `thread_name`, `updated_at`).
- Only `sessions` and `archived_sessions` are watched for changes; the rest of the folder holds databases and logs that change constantly. A session with no reported call has nothing to chart and is not listed. References are `codex-…`, a hash of the thread ID.

## Format

Each line is one JSON record, `{timestamp, type, payload}`. Records are split only at `\n`: text inside them can contain Unicode line separators (U+2028), which some line-splitting functions also treat as line ends. An unfinished last line is skipped.

| `type` | What it holds |
| --- | --- |
| `session_meta` | The first line: the thread's `id`, `timestamp`, `cwd`, `cli_version`, `source` and `thread_source`; `base_instructions.text`, the system prompt; and, in some files, `dynamic_tools`, the definitions of tools the Codex app adds. A forked or spawned thread also has `forked_from_id` or `parent_thread_id`. |
| `turn_context` | One per turn: `model`, reasoning `effort`, `cwd`, and the approval and sandbox settings. |
| `response_item` | What the model sees and produces: `message` (role `user`, `developer` or `assistant`), `reasoning`, `function_call` and `custom_tool_call` and their outputs, `web_search_call`, `tool_search_call` and `tool_search_output`, and `agent_message`. |
| `event_msg` | Events for the app. `token_count` carries usage; `task_started` and `task_complete` mark turns. The rest are for the app's display. |
| `compacted` | A compaction, with `replacement_history`, the whole conversation after it. |
| `token_usage_record`, `world_state`, `inter_agent_communication_metadata` | Not read. See [Not supported](#not-supported). |

## Reading sessions

- **Calls.** A call starts at a response's first output item (reasoning, an assistant message or a tool call), with the items in context at that point. Its usage comes from the next `token_count` event, which Codex writes after the response's tool outputs. An output item after a tool output, with no `token_count` between them, starts a new call without usage. A `token_count` with no input or output, such as the one written after each compaction, is not a call.
- **Usage.** `last_token_usage` is the call's own usage. OpenAI counts cached input inside `input_tokens` and reasoning inside `output_tokens`, so input is `input_tokens` less `cached_input_tokens` and `cache_write_input_tokens`. The model comes from the latest `turn_context`; the provider is `openai` and the API `openai-responses`.
- **Cost.** No cost is recorded. Codex signs in with a ChatGPT plan or an API key, and the file does not say which, so `billing-modes.toml` treats Codex's `openai` calls as a subscription and shows API-equivalent cost, which is also what an API key pays. `codex-auto-review`, the model of guardian reviews, has no public price.
- **System prompt and tools.** `base_instructions` is the system prompt and `dynamic_tools` the app's own tools, both recorded items. Codex's built-in tools (shell, patch and so on) are not recorded (`missingHistoricalToolDefinitions`), so an **Unrecorded request context** item is measured for them, as for Claude Code; see [Claude models](../data-semantics.md#claude-models).
- **Messages.** Developer messages, and user messages that start with a tag such as `<environment_context>` or with `# AGENTS.md`, are written by Codex and become custom messages labelled from the tag. Other user messages are the user's own. Images are recorded as `data:` URLs.
- **Tool calls and results.** A response's text and tool calls are one assistant item. Results are matched to their call by `call_id` and labelled from it: `exec_command` with its command, `apply_patch` with its first file, `view_image` with its path.
- **Reasoning.** Reasoning is recorded only as `encrypted_content`, so each response's reasoning is a Thinking item sized by its `reasoning_output_tokens`. It stays in the context for the rest of its turn and is dropped at the next `task_started`. Within a turn, each call's reported input grows by about the previous call's reasoning tokens (median 1.04 times, over 2,327 calls); at the first call of a new turn it does not (median −1.56, over 1,096 calls).
- **Compaction.** `replacement_history` is the whole conversation after the compaction. Items it repeats exactly are retained; its other messages are new items; and its `compaction` item, whose content is encrypted, is the summary, labelled **Compaction summary · encrypted**. The summary has no countable text, so its size is part of the Unrecorded request context measured after the compaction. The compaction's own call is not recorded (`missingCompactionUsage`).
- **New context windows.** Codex 0.142.5 to 0.146 can record a compaction with an empty `replacement_history`, sometimes followed straight away by a compaction whose history has no summary. The two are read as one compaction, with a summary standing in for what Codex kept (`unverifiedCompactionRetention`).
- **Child sessions.** A guardian review (`source.subagent.other` is `guardian`) is listed as a child session of the thread it reviews (`forked_from_id`), labelled **Guardian review**. A spawned subagent (`source.subagent.thread_spawn`) is listed under `parent_thread_id`, labelled with its nickname and its role or the last part of its path.
- **Inherited history.** A forked or spawned thread's file starts with a copy of its parent's history, including the parent's calls with their usage. Turn and thread IDs are UUIDv7 values, which sort in the order they were made, so the turns whose `task_started` ID sorts before the thread's own ID are the parent's. Their messages, responses and tool results are context for the thread's first call, with the `inherited` metadata; their calls, usage, reasoning and compactions are left out.

## Accuracy

With the system prompt recorded, most of each call's input is in the file. Over the 11,798 calls of the surveyed sessions, the calculated context is a median of 0.5% below the reported input (median absolute difference 1.2%; 90% of calls within 12.7%). The larger differences come from the cases under [Not supported](#not-supported).

## Not supported

- **World state.** `world_state` holds workspace state such as the AGENTS.md text. In 228 files it appears, but in only 79 of them does that text also appear in a message, so it is probably also sent from `world_state`. It is not read, so that text is part of the Unrecorded request context at the call where that is measured, and missing after that if it changes.
- **Unmarked context resets.** In 14 of about 15,000 calls (Codex 0.137 to 0.147), the reported input at the start of a turn falls to a fraction of the calculated context with no `compacted` record. Nothing in the file marks these, so the calculated context stays too large until the next compaction.
- **Partial inheritance.** A spawned subagent can be given only the last few turns of its parent's history (`fork_turns`), and some forks are sent little or none of it, but the file always copies the whole history. Nothing in the file says how much was sent, so in those threads the calculated context is larger than the reported input. Most forks are not affected: their calculated context is a median of 0.1% below the reported input.
- **Linking a spawned subagent to its tool call.** The parent's `spawn_agent` call is not yet linked to the child session it started; child sessions are linked to their parent thread only.
