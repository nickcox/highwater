# Token reports and the agent skill

`highwater report` summarises where sessions spent tokens, as text or JSON, without starting the viewer. `highwater show` prints one item from a session. The `token-efficiency` skill, kept in [`skills/token-efficiency`](../skills/token-efficiency/SKILL.md) and built into the binary, tells a coding agent how to use the two to suggest ways to spend fewer tokens.

## Commands

```bash
highwater report [SESSION...] [--all | --dir PATH] [--last N] [--since YYYY-MM-DD] [--harness NAME] [--json] [--limit N]
highwater show SESSION ITEM_ID [--max-tokens N]
highwater skill print
highwater skill install [--agent agents|claude-code] [--project | --dir PATH] [--force]
```

`report` and `show` take the same source options as `highwater serve` (`--claude-root`, `--codex-home` and so on), and `report` also takes `--tokenization`; see the [README](../README.md#run). The options go after the command, as in `highwater report --codex-home <dir>`.

**Scope.** Without session references, `report` covers the `--last` (default 10) most recently updated sessions run in the current directory's git repository: the directory itself, anywhere inside it, and the repository's other worktrees. A directory outside a repository matches itself and the directories inside it. `--dir` names another directory, and `--all` takes sessions from every directory. Child sessions of the chosen sessions are included and are not counted in `--last`. The repository is found by reading `.git` files and folders, without running git; a session whose directory no longer exists matches only by path.

**Speed.** A release build reports on 10 sessions in about two seconds, most of it spent finding the sessions. A debug build, such as `cargo run`, is about 15 times slower.

**Show.** `show` prints the item's label and its text as Highwater counts it, cut at about `--max-tokens` tokens (default 4,000, at four characters a token). Items measured from reported usage, such as the Unrecorded request context, have no text.

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

The JSON is one object, written without spaces. `schemaVersion` changes when a field is removed or changes meaning.

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
| `models`, `calls`, `userTurns`, `compactions`, `averageContextTokens`, `peakContextTokens` | Its size. `userTurns` counts user messages; `averageContextTokens` is the reported input per call. |
| `tokens` | Reported usage summed over its calls: `freshInput` (neither read from nor written to the cache), `cacheRead`, `cacheWrite`, `output` (including reasoning) and `reasoning`. |
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
| `carriedContext` | `carriedContext.share` is at least 25%. | `share`, `olderThanTurns`, `userTurns`, `calls`, `averageContextTokens`, `compactions` |
| `rerunAfterCompaction` | At least 2 commands or file reads ran again after a compaction removed their earlier results, before the next compaction. Only the first re-run of each after each compaction counts. One finding covers all the session's compactions. | `compactions`, `reruns`, `resultTokens`, `commands` (up to five, with the number of compactions after which each ran again) |

**Forks.** A Pi or Codex fork starts with a copy of its parent's history. Those items count towards the fork's context and its cost, but the fork's `userTurns`, tool runs and findings cover only what happened after the fork, so the parent's runs are not reported twice. In `carriedContext` they count as added before the fork's first turn.

**Command families.** A shell run's family is the first program it runs, with the subcommand for programs that have one (`git status`, `cargo test`) and, after a `run` subcommand, what it runs (`npm run build`, `gh run view`). Variable assignments and `sudo`, `env`, `time`, `nice` and `exec` before the program are skipped, as are options such as `git -C <dir>` and `npm --prefix <dir>` before the subcommand. Only the first command of a pipeline or list counts.

**Same command.** For a shell tool (arguments with `command` or `cmd`), the command, without a leading `cd <dir> &&` or `cd <dir>;`. For a tool whose name contains "read", the path it read, whatever part of the file. For any other tool, its arguments as JSON with keys sorted and null values left out. Paths inside the session's git working tree are written relative to its top folder, and a read tool's relative path relative to it too, so the same file in two worktrees of a repository counts as one file. When the working directory is not in a working tree, or no longer exists, it stands in for the top folder.

## Not yet included

These patterns are planned, with the data Highwater already has: files read again while an earlier read is still in context, repeated status commands (polling), failed tool calls and their retries, fixed overhead per call, tool definitions that are never used, cache misses not explained by a compaction, and what child sessions cost compared with what they return.
