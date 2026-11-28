# Token reports and the agent skill

`highwater report` summarises where sessions spent tokens, as text or JSON, without starting the viewer. `highwater show` prints one item from a session. The `token-efficiency` skill, kept in [`skills/token-efficiency`](../skills/token-efficiency/SKILL.md) and built into the binary, tells a coding agent how to use the two to suggest ways to spend fewer tokens.

## Commands

```bash
highwater report [SESSION...] [--all | --dir PATH] [--last N] [--since YYYY-MM-DD] [--harness NAME] [--json] [--limit N]
highwater show SESSION ITEM_ID [--max-tokens N] [--offset N]
highwater show SESSION ITEM_ID --lines A..B
highwater show SESSION ITEM_ID --grep PATTERN [--around N]
highwater skill print
highwater skill install [--agent agents|claude-code] [--project | --dir PATH] [--force]
```

`report` and `show` take the same source options as `highwater serve` (`--claude-root`, `--codex-home` and so on), and `report` also takes `--tokenization`; see the [README](../README.md#run). The options go after the command, as in `highwater report --codex-home <dir>`.

**Scope.** Without session references, `report` covers the `--last` (default 10) most recently updated sessions run in the current directory's git repository: the directory itself, anywhere inside it, and the repository's other worktrees. A directory outside a repository matches itself and the directories inside it. `--dir` names another directory, and `--all` takes sessions from every directory. Child sessions of the chosen sessions are included and are not counted in `--last`. Sessions that made no model calls, such as a fork that was never used, are left out and the next session takes their place; a session named on the command line is always included. The repository is found by reading `.git` files and folders, without running git; a session whose directory no longer exists matches only by path.

**Speed.** A release build reports on 10 sessions in about two seconds, most of it spent finding the sessions. A debug build, such as `cargo run`, is about 15 times slower.

**Show.** `show` prints the item's label and its text as Highwater counts it, cut at about `--max-tokens` tokens (default 4,000, at four characters a token). Tool results include the producing tool's name and arguments (cut to 500 characters) before the result, when recorded. `--lines A..B` selects a one-based inclusive line range; `--grep PATTERN` selects lines matching a regular expression, with `--around N` lines either side. Selected lines show their original line numbers, followed by `:` for range lines and grep matches, or a space for grep context lines. A `--` line separates non-adjacent groups. Overlapping matches include each line only once. Grep output ends with the number of matching lines out of the item's total lines, or an explicit no-match message; this summary is printed even when output is cut. These two selectors cannot be combined. The token limit still applies to the selected text, including line numbers and group separators. `--offset N` skips characters in that formatted text, not bytes; the cut message gives the next offset to use with the other options unchanged. Items measured from reported usage, such as the Unrecorded request context, have no text.

**Skill.** `skill install` writes `token-efficiency/SKILL.md` into a skills folder:

| | Default | `--project` |
| --- | --- | --- |
| `--agent agents` (default), for Codex and other agents that read `.agents/skills` | `~/.agents/skills` | `<repository>/.agents/skills` |
| `--agent claude-code` | `~/.claude/skills` (or `$CLAUDE_CONFIG_DIR/skills`) | `<repository>/.claude/skills` |

`<repository>` is the top folder of the current git working tree, or the current folder when it is not in one. `--dir PATH` installs into `PATH` instead. The skill only works where Highwater is installed, so a project's copy is useful only to collaborators who have it. A different file already installed is kept unless `--force` is given, since it may have been edited.

## Costs

Costs are in US dollars at the rates the viewer uses: the provider's rate for per-token billing, and the lab's API rate for calls covered by a subscription, which is not a charge. See [Cost assessment](data-semantics.md#cost-assessment).

**Token-turns** are an item's tokens multiplied by the number of calls it was sent with. They add up to about the session's reported input.

**An item's cost** is what it cost over every call it was sent with. At each call, an item sent for the first time in a stretch is priced as a cache write (or as uncached input, for providers without a cache write rate) and the others as cache reads. Those amounts are then scaled so that the call's items add up to the call's input cost from its reported usage. The scaling takes in cache misses, rewrites after a compaction, one-hour cache writes and long-prompt tiers, and spreads them over the call's items in proportion to their modelled cost. The items' costs therefore add up to the session's input cost, but how that cost divides between them is an estimate. Output is not included.

## JSON

The JSON is one object, written without spaces. `schemaVersion` changes when a field is removed or changes meaning. Version 2 counts requests rather than user messages: `turns` counts all requests and `userTurns` counts only those started by the user. Version 1 counted user messages, including harness messages, in `userTurns`.

Token totals are subtotals over calls that recorded each value. `null` means no value was recorded, or the sum exceeded the safe JSON integer range; zero means a recorded zero. Each field has coverage counts under `tokens.coverage`: `recordedCalls`, `failedAttemptCalls` and `missingCalls`. These counts add up to the session's call count. Failed-attempt placeholder counters are not measurements.

`tokens.prompt` includes calls that recorded only total input, without its cache breakdown. Do not reconstruct it by adding the bucket subtotals: those can cover different calls. `averageContextTokens` is the integer average over calls with complete recorded prompt totals, including zero, and `tokens.coverage.prompt.recordedCalls` gives its denominator. Missing calls do not reduce the average. An overflowed prompt subtotal leaves the average `null`, even when calls contributed. Text output gives the coverage beside the average when calls are missing, not counting failed attempts.

| Field | What it holds |
| --- | --- |
| `highwaterVersion`, `priceDataCommit` | The Highwater version and the models.dev commit of its prices. |
| `scope` | `kind` (`directory`, `all` or `sessions`), `directory`, `repository` (the git folder shared by the repository's worktrees), `last`, `since` and `harness`. |
| `thresholds` | The sizes and counts the findings use. |
| `commandFamilies[]` | The 12 shell command families that cost the most over all the sessions, with `sessions`, the number of sessions each ran in; see below. |
| `sessions[]` | One per session; see below. |
| `acrossSessions[]` | Findings over all the sessions. |
| `skipped[]` | Sessions that could not be read or analysed, with `ref` and `reason`. |

Each session has:

| Field | What it holds |
| --- | --- |
| `ref`, `harness`, `title`, `workingDirectory`, `parent`, `childSessions`, `startedAt`, `updatedAt` | What the session is. `ref` is the reference used in view links and by `show`. |
| `models`, `calls`, `turns`, `userTurns`, `compactions`, `averageContextTokens`, `peakContextTokens` | Its size. `turns` counts all turns and `userTurns` counts turns the user started; the average covers calls with complete recorded prompt totals only. |
| `compactionCalls` | The calls that wrote compaction summaries, where the harness records them: `calls` and `usd`, the low end of their cost. They are also counted in `calls` and `cost`. Text output gives their cost beside the number of compactions. |
| `tokens` | Recorded subtotals: `prompt` (total input), `freshInput` (neither read from nor written to the cache), `cacheRead`, `cacheWrite`, `output` (including reasoning exactly once when known) and `reasoning`. Each has matching counts under `coverage`. |
| `cost` | `billed` and `apiEquivalent` ranges (`low`, `high`), as the viewer's session summary gives them, and `unknownCalls`. |
| `reconstruction` | `medianAbsoluteGapPercent`, how far the calculated context is from the reported input, and `limitationCodes` from the session's reader. |
| `contextByKind[]` | The kinds of item that made up at least 1% of the token-turns: `kind`, `items`, `tokenTurns`, `share` (0 to 1) and `estimatedCost`. |
| `carriedContext` | Input spent on the conversation's own items (user and assistant messages, tool results and thinking) at calls 3 or more user turns after they were added: `olderThanTurns`, `tokenTurns`, `estimatedCost` and `share` of the session's token-turns. The system prompt, tool definitions, attachments, compaction summaries and the Unrecorded request context are not included. |
| `commandFamilies[]` | The six shell command families that cost the most: `family`, `runs`, `failed`, `resultTokens`, `resultTokenTurns` and `resultEstimatedCost`. |
| `tools[]` | The six tools whose results and definitions cost the most: `calls` (results recorded), `failed`, `resultTokens` (`total`, `max`), `resultTokenTurns`, `resultEstimatedCost`, and `definitionTokens` and `definitionEstimatedCost` when the harness records the tool's definition. |
| `findings[]` | See below. |

## Findings

A finding has a `pattern`, a `basis` (`measured`, or `estimated` when it depends on the cost model), an `estimatedCost` (`usd` and `tokenTurns`), a one-line `summary`, up to three `items` (`itemId`, and `ref` for findings across sessions) and `facts` specific to the pattern. Findings state what was measured, not what to change.

For each pattern, the report keeps the `--limit` (default 10) most expensive findings over all the sessions, and the same number across sessions.

| Pattern | When | `facts` |
| --- | --- | --- |
| `largeLongLivedResult` | A tool result of at least 5,000 tokens was in context for at least 10 calls. | `tokens`, `presentCalls`, `firstCall`, `lastCall`, `tool` |
| `repeatedCommand`, in a session | One tool ran with the same command at least 3 times, or ran again with a result identical to an earlier run's. | `tool`, `command`, `runs`, `identicalResults`, `failed`, `resultTokens` |
| `repeatedCommand`, across sessions | One tool ran with the same command in at least 3 of the sessions. | `tool`, `command`, `runs`, `sessions`, `failed`, `resultTokens` |
| `carriedContext` | `carriedContext.share` is at least 25%. | `share`, `olderThanTurns`, `userTurns`, `calls`, `averageContextTokens`, `averageContextRecordedCalls`, `compactions` |
| `rerunAfterCompaction` | At least 2 commands or file reads ran again after a compaction removed their earlier results, before the next compaction. Only the first re-run of each after each compaction counts. One finding covers all the session's compactions. | `compactions`, `reruns`, `resultTokens`, `commands` (up to five, with the number of compactions after which each ran again) |
| `repeatedResultInContext` | A tool result of at least 1,000 tokens is identical to an earlier result of any tool that was still in context when it was first sent. Results are compared by their content, without the tool call's ID or the tool's name. One finding covers the repeats returned by one tool and command. | `tool`, `command`, `repeats`, `resultTokens`, `firstCall` (of the earliest identical result), `callsBetween` (from it to the first repeat), `failed` |
| `largeUnlimitedOutput`, in a session | A shell command or search returned at least 5,000 tokens without limiting its output. See below for which commands and limits count. One finding covers a command family, or a search tool, whichever shell tool ran it. | `tools`, `family`, `runs`, `resultTokens`, `largestResultTokens`, `commands` (up to three, largest result first) |
| `largeUnlimitedOutput`, across sessions | The same, for a family with such a result in at least 3 of the sessions. | as above, and `sessions` |
| `cacheMiss` | At least one call read at least 10,000 tokens, and at least half of what was expected, fewer from the cache than expected. See below. One finding covers all of a session's misses. | `providers`, `misses`, `afterPause`, `unexplained`, `unknownTiming`, `shortfallTokens`, `cacheLifetimeSeconds`, `usd` (total whole-call cost of all misses), `calls` (up to five, largest shortfall first, each with `call`, `usd` (whole-call cost), `shortfallTokens`, `cause` and `pauseSeconds`) |
| `fixedOverhead`, across sessions | For each harness with at least 3 of the sessions: what its sessions sent before any work. See below. | `harness`, `sessions`, `medianFirstCallTokens`, `largestFirstCallTokens`, `shareOfInput`, `shareOfCost`, `parts` (up to eight, most expensive first, each with `kind`, `label`, `sessions`, `medianTokens`, `estimatedCost`, and `usedInSessions` for a tool definition) |

**Repeated results.** `repeatedResultInContext` does not decide which tools read files. A large identical result means the agent was sent text it could already see, whatever the tool. The size threshold leaves out edit and write confirmations, and an edit between two reads changes the text, so that read is not counted. It is not counted either when the earlier copy was removed by a compaction; `rerunAfterCompaction` covers that. A repeat also counts towards `repeatedCommand`'s `identicalResults`, which does not check whether the earlier result was in context.

**Unlimited output.** `largeUnlimitedOutput` covers shell commands in the families `cat`, `git diff`, `git show`, `git log`, `grep`, `rg`, `find`, `ls` and `tree`, and the search tools `Grep`, `Glob`, `grep`, `glob`, `find`, `grep_search` and `file_search`. A shell command limits its output when it pipes into `head`, `tail`, `grep`, `rg`, `jq`, `wc`, `cut`, `sed`, `awk` or `less`; when `git diff` or `git show` has `--stat`, `--name-only`, `--name-status`, `--shortstat`, `--numstat`, `--no-patch`, `-s` or `--quiet`; when `git log` has a count (`-n 5`, `-5`, `--max-count`); and when `grep` or `rg` has `-l`, `-L`, `-c`, `-m`, `-q` or their long forms. A path is not a limit. A search tool limits its output with `head_limit`, `limit`, `maxResults` or `max_results`, and Claude Code's `Grep` also unless its `output_mode` is `content`. A shell command that runs several commands in turn (with `;`, `&&`, `||` or several lines) is left out, because its output cannot be divided between them. Test runners and builds are left out, because their output is hard to shorten from the command line; `repeatedCommand` covers them when they run often. Read tools are left out, because reading a whole file is often needed; `largeLongLivedResult` covers large reads that stay in context. A result can be in both this finding and `largeLongLivedResult`: that one is about how long the result stayed, this one about the command that produced it.

**Cache misses.** `cacheMiss` compares each call with the one before it, when both have the same provider, model and API, complete usage under the same pricing policy, no compaction between them, neither was retried, and neither is a compaction's own call, which reads the conversation to summarise it rather than the cached prompt. These are the same calls the viewer compares for a change in cache read ratio, apart from compaction calls. A call is expected to read from the cache the smaller of the two calls' prompts, and the shortfall is how much less it read. A miss's cause is `afterPause` when the time since the previous call is longer than the cache lifetime, `unexplained` when it is shorter, and `unknownTiming` when the times are not recorded. The lifetime is one hour in a session that wrote one-hour cache entries and five minutes otherwise; providers without a fixed lifetime, such as OpenAI, keep cached prompts for roughly 5 to 10 minutes after their last use, so the cause is approximate for them. OpenAI's caching is also best effort, so some of its unexplained misses have a cause the session files cannot show. Claude Code and Codex do not record when a call started, so for them the time is measured between the two calls' ends and includes the later call's own generation time. The estimated cost of a miss is its shortfall priced at the cache write rate less the cache read rate, or the input rate less the cache read rate for a provider with no cache write rate. The one-hour write rate is used when that call wrote any one-hour entries; otherwise the five-minute rate is used. The facts also give the whole cost of the missed calls as `usd`, both in total and for each listed call, rather than just the estimated shortfall cost. As in `cacheRewrites`, listed call costs use four decimal places and the total sums costs before rounding; unknown costs are null and excluded from the total.

**Fixed overhead.** `fixedOverhead` counts the items a session sends before any work, other than those a fork copied from its parent: system prompts and tool definitions, including later versions of them; Unrecorded request context measured at the first call, at the first call after a compaction or at a change of model, but not the input of a compaction's own call; and messages the harness adds (`customMessage`, such as Claude Code's skill listing and instructions, or Codex's permissions instructions, app context and `AGENTS.md`) sent at the first call, or sent again after a compaction with the label of one the compaction removed. These are the viewer's rules for an item that takes the place of an earlier one. Claude Code does not record its system prompt or tool definitions, including MCP tools, so they are part of its Unrecorded request context. `shareOfInput` is the counted items' cost as a part of the sessions' input cost, and `shareOfCost` as a part of their input and output cost, both at the rates the item costs use; the `cost` field of each session can differ from these, because it sometimes comes from what the harness recorded. The first call's prompt also includes the user's first message, and forks are left out of `medianFirstCallTokens` and `largestFirstCallTokens`, because their first call also sends their parent's history; a thread that started with copied history Highwater does not mark as copied can still make `largestFirstCallTokens` large. A part's `medianTokens` is its median size over the sessions it was in, and its largest version in a session that sent it more than once. A tool definition is used in a session when the session ran a tool of that name, or of the part of the name after its last `.`.

**Forks.** A Pi, Codex or Claude Code fork starts with a copy of its parent's history. Those items count towards the fork's context and its cost, but the fork's `userTurns`, tool runs and findings cover only what happened after the fork, so the parent's runs are not reported twice. In `carriedContext` they count as added before the fork's first turn.

**Command families.** A shell run's family is the first program it runs, with the subcommand for programs that have one (`git status`, `cargo test`) and, after a `run` subcommand, what it runs (`npm run build`, `gh run view`). Variable assignments and `sudo`, `env`, `time`, `nice` and `exec` before the program are skipped, as are options such as `git -C <dir>` and `npm --prefix <dir>` before the subcommand. Only the first command of a pipeline or list counts.

**Same command.** Each session reader identifies its harness's shell and file-reading tools. For a shell tool, the key is the command, without a leading `cd <dir> &&` or `cd <dir>;`. For a file-reading tool, the key is the path it read, whatever part of the file. For any other tool, the key is its arguments as JSON with keys sorted and null fields left out, or the trimmed arguments if they are not JSON. Paths inside the session's git working tree are written relative to its top folder, and a read tool's relative path relative to it too, so the same file in two worktrees of a repository counts as one file. When the working directory is not in a working tree, or no longer exists, it stands in for the top folder.

## Input and context costs

Each session adds `costByInput`: `uncached`, `cacheRead`, `cacheWrite` and
`output`, each with `tokens` and `usd`, plus `medianUncached` and
`largestUncached` per call (whole tokens; an even median rounds down). Missing counters are not zero. Recorded component
costs are used when all four are available (Pi, OpenCode and Copilot). Otherwise the
same dated prices as item costs determine the shares, including prompt tiers,
and those shares are fitted to the call's known total. A call with only a
total cost needs prices and usage to allocate it; without those its allocation
is unknown. A call without a recorded cost uses dated prices where available.
Null means no known values; sums with missing calls are partial. Ranges use
the low estimate, as item costs do.

`costByContextSize` gives `prompt`, `calls` and `usd` for reported prompts
below 50K, 50–100K, 100–200K, 200–400K and at least 400K. Calls without a
reported prompt are excluded. `cacheRewrites` gives `calls`, `usd`,
`afterExpiry` and up to five `largest` writes (`call`, `tokens`, `usd`,
`breakSeconds`). It excludes the first call and compaction calls, requires a prompt
of at least 20,000 tokens and a write of at least half the prompt. Breaks use
previous end to current start, falling back to current end; missing timing
is not counted as expiry. Expiry is one hour if any call wrote one-hour
entries, five minutes otherwise. Its cost is the whole call, not a cache-miss
penalty. These two fields also have report-wide totals; report-wide rewrites
do not repeat the largest entries.

`largestItems` contains up to ten items ranked by existing estimated item
cost: full `id` for `highwater show`, `kind`, `label`, `tokens`, `calls`
present, `firstCall` and `usd`. These are estimates over all calls where the
item was present, not additional charges.

New dollar figures use four decimal places, as other report costs do.
Largest-item labels are limited to 80 characters; IDs are not shortened.

### Turn figures

Each session's `turnsByStarter` groups turns by starter (`user`, `taskNotification`, `heartbeat`, `compaction`, `guardianReview`, `injectedContext` and other recorded starters), with `turns`, `calls` and `usd`. The report-level `turnsByStarter` sums these over sessions in scope.

`expensiveTurns` lists up to three turns ranked by their whole-call cost, with ties in turn order: `turn`, `firstCall`, `lastCall`, `usd`, `breakSeconds`, `firstPromptTokens`, `lastPromptTokens`, `starter` and `prompt`. Prompt token counts are the reported totals at the first and last call; `prompt` is the first 80 characters of a user prompt, or null for other starters. Breaks use the same timing and whole seconds as `cacheRewrites`; the first turn has no preceding break. Missing figures are null. Costs sum known call costs before rounding to four decimal places, as in the other per-call figures. Text output briefly lists starter totals and the most expensive turn ranges.

## Not yet included

This pattern is planned, with the data Highwater already has: what child sessions cost compared with what they return.

Polling and failed tool calls are not findings of their own. On the sessions they were measured on, both cost little: polling was mostly done inside one command that waits, and most failures were commands that exit with a code other than 0 as part of normal work, such as tests and searches with no matches. Failed runs are counted in `tools[].failed`, `commandFamilies[].failed` and the `failed` fact of `repeatedCommand` and `repeatedResultInContext`.
