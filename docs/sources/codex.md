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
| `world_state` | The state Codex builds its own context messages from (AGENTS.md text, skills, permissions, environment). Those messages are also recorded as `response_item`s, so it is not read. |
| `token_usage_record`, `inter_agent_communication_metadata` | Not read. |

## Reading sessions

- **Calls.** A call starts at a response's first output item (reasoning, an assistant message or a tool call), with the items in context at that point. Its usage comes from the next `token_count` event, which Codex writes after the response's tool outputs. An output item after a tool output, with no `token_count` between them, starts a new call without usage. A `token_count` with no input or output, such as the one written after each compaction, is not a call.
- **Usage.** `last_token_usage` is the call's own usage. OpenAI counts cached input inside `input_tokens` and reasoning inside `output_tokens`, so input is `input_tokens` less `cached_input_tokens` and `cache_write_input_tokens`. The model comes from the latest `turn_context`; the provider is `openai` and the API `openai-responses`.
- **Cost.** No cost is recorded. Codex signs in with a ChatGPT plan or an API key, and the file does not say which, so `billing-modes.toml` treats Codex's `openai` calls as a subscription and shows API-equivalent cost, which is also what an API key pays. `codex-auto-review`, the model of guardian reviews, has no public price.
- **System prompt and tools.** `base_instructions` is the system prompt and `dynamic_tools` the app's own tools, both recorded items. Codex's built-in tools (shell, patch and so on) are not recorded (`missingHistoricalToolDefinitions`), so an **Unrecorded request context** item is measured for them, as for Claude Code; see [Claude models](../data-semantics.md#claude-models).
- **Messages.** Developer messages, and user messages that start with a tag such as `<environment_context>` or with `# AGENTS.md`, are written by Codex and become custom messages labelled from the tag. Other user messages are the user's own. Images are recorded as `data:` URLs.
- **Tool calls and results.** A response's text and tool calls are one assistant item. Results are matched to their call by `call_id` and labelled from it: `exec_command` with its command, `apply_patch` with its first file, `view_image` with its path.
- **Reasoning.** Reasoning is recorded only as `encrypted_content`, so each response's reasoning is a Thinking item sized by its `reasoning_output_tokens`. Within a turn it stays in the context: each call's reported input grows by about the previous call's reasoning tokens (median 1.04 times, over 2,327 calls). Whether it reaches later turns depends on the model. At the first call of a new turn, GPT-5.5's input falls by exactly the reasoning of the turn before (median ratio 0.00, over 233 turns), while for GPT-5.6 and GPT-6 models the reasoning is still there (median 1.1 to 1.3). So reasoning is dropped at the next `task_started` for GPT models before 5.6 and kept until the next compaction for GPT-5.6 and later; a model that is not recognised is treated like the newest ones.
- **Compaction.** `replacement_history` is the whole conversation after the compaction. Items it repeats exactly are retained; its other messages are new items; and its `compaction` item, whose content is encrypted, is the summary, labelled **Compaction summary · encrypted**. The summary has no countable text, so its size is part of the Unrecorded request context measured after the compaction. The compaction's own call is not recorded (`missingCompactionUsage`).
- **New context windows.** Codex 0.142.5 to 0.146 can record a compaction with an empty `replacement_history`, sometimes followed straight away by a compaction whose history has no summary. The two are read as one compaction, with a summary standing in for what Codex kept (`unverifiedCompactionRetention`).
- **Web searches.** OpenAI runs a web search inside a response, with further model steps, and the response's usage adds up every step. A response with a `web_search_call` therefore has the stop reason `web-search-aggregate`: its input is shown but not compared with its context, and the Unrecorded request context is never measured at it. The search results are not recorded but stay in the context, about 2,500 tokens a search (median, over 62 responses), and are still there a few calls later. So each such response starts a new Unrecorded request context segment, measured at the next call and covering the response itself.
- **Child sessions.** A guardian review (`source.subagent.other` is `guardian`) is listed as a child session of the thread it reviews (`forked_from_id`), labelled **Guardian review**. A spawned subagent (`source.subagent.thread_spawn`) is listed under `parent_thread_id`, labelled with its nickname and its role or the last part of its path.
- **Inherited history.** A forked or spawned thread's file starts with a copy of its parent's history, including the parent's calls with their usage. Turn and thread IDs are UUIDv7 values, which sort in the order they were made, so the turns whose `task_started` ID sorts before the thread's own ID are the parent's. Their messages, responses and tool results are context for the thread's first call, with the `inherited` metadata; their calls, usage, reasoning and compactions are left out.
- **Inferred boundaries.** Two things that change what a call is sent are not recorded, but show when a call's reported input is under half its calculated context. That test uses a rough size for each item (characters ÷ 4), which is enough for a gap that size.
  - At a forked or spawned thread's first call, the thread was given little or none of its parent's history (a spawned subagent can be given only its parent's last few turns). The oldest inherited items are left out until the context fits the reported input (`inferredUnsentHistory`).
  - At the first call of a turn otherwise, the context was reset without a compaction record. The earlier conversation is replaced by a stand-in summary labelled **Context reset · inferred from usage**, recorded as a compaction before that call (`inferredContextReset`).

## Accuracy

With the system prompt recorded, most of each call's input is in the file. Over the 11,698 compared calls of the surveyed sessions (103 web-search responses are not compared), the calculated context is a median of 0.1% below the reported input (median absolute difference 0.2%; 90% of calls within 5.3%). About 5% of calls still differ by more than 9%, for the reasons under [Not supported](#not-supported) and in a few sessions for reasons not yet found.

## Not supported

- **Inferred boundaries that are not visible.** A reset or unsent history is only found when the reported input falls under half the calculated context. A smaller gap is shown as it is.
- **`wait` results.** The exec tool's `wait` results are recorded as the full list of output chunks, but the model is sent less (in the surveyed sessions, about 12,000 tokens of a median 18,000). There are too few to work out the rule, so they are counted at their recorded size.
- **Linking a spawned subagent to its tool call.** The parent's `spawn_agent` call is not yet linked to the child session it started; child sessions are linked to their parent thread only.
