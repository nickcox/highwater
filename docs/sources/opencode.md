# OpenCode sessions

How Highwater reads [OpenCode](https://github.com/anomalyco/opencode) sessions. For the rules that apply to every source, such as tokenization and cost, see [data semantics](../data-semantics.md).

## Where sessions are

OpenCode keeps sessions in SQLite databases, `opencode.db` and `opencode-stable.db`, under `$XDG_DATA_HOME/opencode` (default `~/.local/share/opencode`), each with `-wal` and `-shm` files. Without source options, Highwater reads those that exist. `--opencode-db` (repeatable) replaces the default list, and `--session-root` on its own turns it off. If a database given with `--opencode-db` is missing, Highwater does not start.

Databases are opened read-only, never migrated or opened with a writable fallback. No credentials or account tables are queried, and referenced files and URLs are never fetched. An OpenCode session with no assistant message has nothing to chart and is not listed, though it is still validated. References are `opencode-…`, a hash of the native session ID, and contain no database path. The same native ID in two databases is ambiguous, and a request for it is rejected rather than choosing one copy.

## Format

- **Legacy layout:** `session`, `message` and `part` tables. Message and part `data` columns are JSON; IDs and parent and session relationships are columns. Messages are ordered by creation time and ID, and parts by ID. Part types include `text`, `reasoning`, `tool` (one mutable state object holding both the call and its result), `file`, `compaction`, `step-start`, `step-finish` and `patch`.
- **Modern layout:** `session_v2` and `session_message`, ordered by their native `seq`.
- Databases differ in columns between versions, so Highwater reads only the columns it needs and checks which exist, rather than depending on a migration number.

## Reading sessions

- **Layouts.** Highwater reads the legacy `session`, `message` and `part` tables and the modern `session_v2` and `session_message` tables, including databases with only the modern ones. Modern records are read in their own `seq` order. When a database has both layouts, each session is read from one of them, never a mix of the two. The experimental context and input tables are not supported.
- **Duplicate sessions.** When both layouts hold the same session, a legacy row that is strictly newer wins; otherwise the modern one does. If the modern session has no messages, the legacy one is used only when their timestamps are equal and it has messages. A newer, empty modern session never brings back older legacy content. This is a rule based on recency, not proof of which version OpenCode last wrote.
- **Legacy sessions.** A tool part holds both the call and its result. When OpenCode prunes an old tool result, calls before and after the pruning see different versions of it.
- **Child sessions.** A session's `parent_id` lists it as a child session of that session. The task tool that started it records the child's ID in `state.metadata.sessionId`, so the tool's result links to the child session (the item's `childSession` metadata).
- **Modern sessions.** Reasoning and tool calls inside messages, assistant records that carry only usage, recorded system prompt updates and injected context are all read. A completed compaction replaces the history with the recorded summary and the recent exchange OpenCode saved with it. A failed or still-running compaction leaves the history as it was. A compaction at the very end of a session, or one replaced by a later one, is shown but appears in no call's context.
- **Rejected sessions.** Sessions with reverts, OpenCode's encrypted checkpoints, unknown record types, or legacy histories with tails, synthetic messages or multiple steps that have not been checked against OpenCode's source are rejected rather than guessed at.

## Coverage

Every OpenCode analysis is marked partial, and the **Estimates** note above Session details lists its limitations. Recorded system prompt updates in modern sessions are kept, but they may not show the whole prompt from the start of the session. The system prompt and tools are measured instead as an **Unrecorded request context** item, as described under [Claude models](../data-semantics.md#claude-models), for every model. Images stored as base64 `data:` URLs in tool-result attachments and user file parts are counted as images; other attachments are reported as unsupported content. A note is added when a session was read from one of two layouts, when request boundaries come from migrated data, when a compaction has no recorded usage, and when a compaction's cost covers several requests.

## Usage and cost

OpenCode records optional token counters and a total cost for each call, and Highwater keeps each as recorded.

Whether a step's output includes its reasoning is decided from the step's stored `total`, which OpenCode takes from the provider and which counts reasoning once. Up to v1.3.x, output included reasoning (total = input + output + cache); from v1.4.0, reasoning is stored separately (total = input + output + reasoning + cache). Modern records have no `total`, so a modern record uses the legacy step-finish copy with the same message ID, when there is one and all its counters match. The database layout and the session's creation version are never used to decide this. When a step's total fits neither rule, or it has none, its output stays unavailable.

The recorded cost is kept as it is; the [cost assessment](../data-semantics.md#cost-assessment) adds estimates and API-equivalent costs separately. OpenCode sessions have no cost components, cache figures or durations, and the recorded cost is not presented as what was billed.

## Freshness and limits

Each analysis reads a committed snapshot of the database, and checks a digest of the session's content before reusing a cached result or answering `304`. Changes to the database or its `-wal` and `-shm` files, plus polling every two seconds, refresh the catalogue and notice when a database is replaced. If one database fails to read, the others keep updating, and the failed one keeps the last catalogue it read successfully.

Reads from SQLite are limited to 32 MiB per value or row, 256 MiB of loaded strings in total, 200,000 rows (legacy messages and parts, or modern messages) and 50,000 sessions, with a 250 ms busy timeout. These limit what is read from the database, not the server's total memory: a stress test with a large database and oversized responses used about 848 MiB, so very large sessions need plenty of memory. A conditional request still reads and hashes the current snapshot, which took about 445 ms for a synthetic 128 MiB database. Responses larger than the 16 MiB response cache are rebuilt even for conditional requests. A response reflects the snapshot its request read; later writes appear on the next refresh.

## Not supported

- Compactions that keep a recorded tail (`tail_start_id`), reverts and forks, multi-step or retried calls in legacy histories, and synthetic shell or subtask assistants. Sessions with these histories are rejected rather than guessed.
- Populated alternate modern storage, and cache or output policies that would need to know which OpenCode version and provider API wrote each message.
- The system instructions, tool schemas, environment, skills and plugin transforms that OpenCode assembles at request time. Stored chat is not the exact request, and current project files or settings cannot reconstruct it.
- The compaction's own model call, which has its own prompt and is not stored as a normal call.

## Upstream source used as evidence

The rules above were checked against OpenCode's source at these versions:

- [v1.4.0 `message-v2.ts`](https://github.com/anomalyco/opencode/blob/v1.4.0/packages/opencode/src/session/message-v2.ts): row hydration, message and part order, `filterCompacted` and `toModelMessages`.
- [v1.4.0 `compaction.ts`](https://github.com/anomalyco/opencode/blob/v1.4.0/packages/opencode/src/session/compaction.ts): summary linkage, the summary model call, automatic continuation and tool-result pruning.
- [v1.4.0 `index.ts`](https://github.com/anomalyco/opencode/blob/v1.4.0/packages/opencode/src/session/index.ts) and [v1.2.24 `index.ts`](https://github.com/anomalyco/opencode/blob/v1.2.24/packages/opencode/src/session/index.ts): `getUsage` normalisation and cost.
- [v1.4.0 `processor.ts`](https://github.com/anomalyco/opencode/blob/v1.4.0/packages/opencode/src/session/processor.ts): step usage against assistant totals. The processor records usage and cost on both the assistant message and the step-finish part, so summing both would count them twice.
- [v1.4.0 `prompt.ts`](https://github.com/anomalyco/opencode/blob/v1.4.0/packages/opencode/src/session/prompt.ts): context filtering, system instructions assembled at request time, and plugin transforms.

Pruning sets `state.time.compacted` on a tool part without deleting its stored output; `toModelMessages` then sends `[Old tool result content cleared]` in its place. Calls before and after pruning therefore see different versions of the same tool result.

`python3 scripts/benchmark-opencode.py --full` and `node scripts/accept-opencode-readonly.mjs` check performance and real databases; see [development](../development.md).
