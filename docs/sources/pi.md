# Pi sessions

How Highwater reads sessions written by the Pi coding agent (`@earendil-works/pi-coding-agent`). For the rules that apply to every source, such as tokenization and cost, see [data semantics](../data-semantics.md).

## Where sessions are

Pi writes one JSON Lines file per session under `~/.pi/agent/sessions`. Without `--session-root`, Highwater reads each of these folders that exists:

- `$PI_CODING_AGENT_SESSION_DIR`.
- `sessionDir` in Pi's `settings.json`, in Pi's agent folder (`$PI_CODING_AGENT_DIR`, default `~/.pi/agent`). A path starting with `~/` is in the home folder; other relative paths are not used, because Pi reads them from the working directory.
- `sessions` in Pi's agent folder.
- Sessions bb runs through Pi: `$BB_PI_BRIDGE_SESSION_DIR`, otherwise `~/.bb/plugins/provider-pi/bridge-data/sessions`, and the older `~/.bb/pi-bridge-sessions`.

`--session-root` (repeatable) replaces these folders. A file found through two folders, such as a folder and a folder inside it, is listed once. An explicit `--session-root` on its own reads Pi sessions only; add the other source flags to include them too.

The catalogue reads the first line of each file, the `session` header, for the session ID, working directory (`cwd`) and start time. The public reference is `pi-` followed by 12 hexadecimal characters of a BLAKE3 hash of the session ID. A file without a valid header is still listed, under a reference derived from its first line. The title is the working directory's folder name and the suffix of the file name.

## Format

Each line is one entry with a `type`. Entries other than the header have an `id` and a `parentId`, so the file is a tree: rewinding and retrying in Pi starts a new branch from an earlier entry.

| Entry `type` | What Highwater uses |
| --- | --- |
| `session` | Header: `id`, `cwd`, `timestamp`, `version`, and `parentSession`, the parent's file, for a session made with `/fork` or `/clone`. |
| `message` | `message.role` is `user`, `assistant`, `toolResult` (or `tool`), `system` or `toolDefinition`. An assistant message has `content` blocks (text, thinking, tool calls with `id`, `name` and `arguments`), `provider`, `model`, `api`, `stopReason`, `timestamp`, `usage` and `cost`. A tool result has `toolCallId`, `toolName`, `content` and `isError`. |
| `custom_message`, `branch_summary` | Context added by extensions, and the summary Pi writes when a session moves to another branch. |
| `compaction` | `summary`, `tokensBefore`, `firstKeptEntryId`, and usually `usage`, the usage and cost of the call that wrote the summary. |
| Others | Ignored. Command-shaped records never enter the context. |

## How Highwater reads a session

- **Branch.** Every entry is checked first: duplicate IDs, cycles and missing parents fail the session, including on branches that are not shown. The active branch ends at the last-written entry that has no children, and is followed back through `parentId` to the root.
- **Calls.** Each assistant message on the branch is one model call. Its context is every context item before it on the branch.
- **Context items.** User messages, assistant messages, tool results, agent-added context from extensions, branch summaries, and the system prompt and tool definitions (see below). A tool result is labelled from its tool call on the selected branch, for example **Write result · filename**.
- **Compaction.** After a `compaction` entry the context is its summary, followed by the branch's entries from `firstKeptEntryId` onwards, which continue as retained items. Items before that point end at the last call before the compaction, and are drawn as the summary's sources. The compaction's rule is `keptFromEntry`.
- **Compaction calls.** A `compaction` entry with `usage` (101 of 102 surveyed) records the call that wrote the summary. It becomes a call before the compaction, with the stop reason `compaction-call`, the previous call's model, and the entry's usage and cost. Pi does not record what it sent: on 95 local compaction calls, the removed items were a median of 2.3 times the call's input, so Pi sends them in a shortened form. The call's context is therefore one item, **Compaction input · not recorded**, sized by its reported input.
- **Forks.** A session made with `/fork` or `/clone` starts with a copy of its parent's entries, which keep their own timestamps, after a header with the time the fork was made. The entries older than the header are the parent's. Their messages, responses, tool results and compactions shape the context of the fork's first call, and those items have the `inherited` metadata; their calls, with their usage, and their compactions are not the fork's.
- **Failed attempts.** An aborted or errored response with default-zero counters keeps them as placeholder usage (`usage.placeholder`), not as measurements, and its cost is unknown.
- **Unfinished last line.** While Pi is still writing a session, its last line is skipped if it has no trailing newline and is not yet valid JSON. Every completed line must be valid.

## Usage, cost and timing

Pi records each response's usage (`input`, `output`, `cacheRead`, `cacheWrite`, the one-hour part of cache writes, optional `reasoning`, `totalTokens`) and a cost per component. Output already includes reasoning. Pi calculates its cost from its own built-in rates, including for subscription logins such as `openai-codex`; see [cost assessment](../data-semantics.md#cost-assessment) for how Highwater uses it.

`startedAtMs` is the assistant message's `timestamp` and `recordedAtMs` the entry's. For Pi's built-in APIs, a positive interval between them gives an approximate duration (basis `pi-message-timestamps`) and output rate; see the [analysis API](../data-semantics.md#analysis-api).

## System context

Pi records its system instructions and tool declarations, including later changes to them: changed sections, tools added or removed, and the state saved at each compaction. Highwater replays these into a separate version of the system prompt and of each tool definition for each call. They appear in the River and Composition, but are never counted twice and are never drawn as sources of a compaction summary. Cumulative Composition counts each version only at the calls where it was present, so an old and a new version are never added together for the same call. Versions of the system prompt, and of a tool definition with the same name, are linked as versions of one item when one starts after the previous one ends. The browser works this out, and it changes no estimate or total.

These estimates describe the context Pi meant to send, not the exact request the provider received: the generic JSON of the tool declarations, and the way each provider sends updates partway through a conversation, can differ from what was transmitted. So they are reported as partial. Older sessions can lack this material, and its absence does not mean zero tokens. Provider-reported usage and cost are kept separate from these estimates.

Pi 1.0.4's documentation describes `replace: true`, but its replay code ignores it. Rather than guess, Highwater marks the system context as unavailable from that point until a compaction saves a complete state again. A modern recorded tool loadout replaces older standalone declaration records. No earlier prompt is worked out from current installation files or from the gap between reported and estimated input.

## Freshness

A session's analysis is identified by the file's size and modification time, checked before and after reading. A rewrite that keeps both can go unnoticed, and file system races are not completely ruled out. The session folder is watched for changes.

The catalogue takes the first ordinary user message, excluding extension messages, commands and branch summaries, using the Pi reader’s content rules. An expanded skill block is shown as `/skill:<name>`, followed by any typed text after the block; its instructions are excluded. The reconstructed prompt has the same 300-character limit as other prompts. Prompt and assistant-message detection is limited to the first 1 MiB. Sessions without an assistant message in that range are not listed; direct references to unlisted sessions are unavailable, as for Claude Code.

The header is the first `session` record in the first five lines, allowing a preceding non-header record. The latest non-empty `session_info.name` supplies the display name, falling back to the project and short ID. Names set by `/name`, `--name` or `pi.setSessionName()` are supported; undocumented `title` records are not used as names. The listing scans the whole file for names, but after the bounded message search it parses only lines whose text contains `"session_info"`. Listings are cached by file size and modification time, so unchanged files are not read again.
