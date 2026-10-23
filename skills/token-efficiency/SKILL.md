---
name: token-efficiency
description: Analyse recent coding-agent sessions with Highwater and suggest concrete ways to spend fewer tokens, such as narrower commands, new skills or scripts, and instruction changes. Use when the user asks where their agent sessions spend tokens, why sessions are expensive, or how to make them more efficient.
---

# Token efficiency

Highwater reads the session files that Claude Code, Codex, OpenCode, Pi and VS Code Copilot Chat keep on this computer. `highwater report` summarises where those sessions spent tokens, and `highwater show` prints one item from a session. Use them to find the few changes that would save the most, and explain each one with the evidence for it.

## 1. Check Highwater is installed

Run `highwater --version`. If the command is not found, tell the user it can be installed with `brew install nickcox/highwater/highwater` or `cargo install --git https://github.com/nickcox/highwater --locked`, and stop.

## 2. Run the report

```bash
highwater report --json
```

By default this covers the 10 most recently updated sessions run in the current directory's git repository, including its other worktrees, with their child sessions. Choose the scope from what the user asked:

- **A general review** ("where do my sessions spend tokens?"): the default. Patterns repeated across sessions only show up here. Use `--last 20` or more only when the user asks for a wider look; the report grows by about 700 tokens for each session.
- **A particular session**, named by a reference such as `claude-code-51475cc186e8` or by a Highwater view link (its `session=` value): `highwater report --json <reference>`.
- **The session the user just finished:** `highwater report --json --last 2`, and look at the second session. The first is the one you are running in.
- Other options: `--all` (every directory), `--dir PATH` (another project), `--since YYYY-MM-DD`, `--harness claude-code|codex|opencode|pi|vscode-copilot`.

The most recently updated session is nearly always the one you are running in. It is unfinished and includes your own work on this request, so leave it out of your conclusions unless the user asked about it.

If the report lists no sessions, say so and suggest `--all` or `--dir`.

## 3. Read the report

- **Costs are estimates** in US dollars at API rates. For calls covered by a subscription they are what the API would have charged, not what the user paid. Use them to rank, and say they are estimates.
- **Token-turns** are tokens multiplied by the number of calls they were sent with. A 10,000-token file read that stays in context for 100 calls is 1,000,000 token-turns, even though it was read once. Most of a long session's cost is input sent again on every call, mostly read from the cache.
- An item's `estimatedCost` is what that item cost over every call it was sent with. It is the most that removing the item could save, not the expected saving.
- The report keeps unavailable token subtotals as `null`, not zero. `tokens.coverage` gives `recordedCalls`, `failedAttemptCalls` and `missingCalls` for each token field. Treat a subtotal with missing calls as partial. `tokens.prompt` includes total-only input; do not reconstruct it from cache buckets that may cover different calls. `averageContextTokens` covers only calls with complete prompt totals, with `tokens.coverage.prompt.recordedCalls` as its denominator. Check that coverage before comparing sessions.
- Each session has `tokens`, `cost`, `averageContextTokens`, `userTurns`, `contextByKind` (what made up the context, as a share of token-turns), `carriedContext`, `tools` (the most expensive tools), `commandFamilies` (shell commands grouped by program and subcommand, such as `rg` or `git diff`) and `findings`.
- `commandFamilies` at the top level totals the shell commands over all the sessions, and `acrossSessions` holds commands and file reads repeated in several sessions.
- **Look at the totals before the findings.** In long sessions most of the cost is spread over many items: hundreds of small tool results, the agent's own messages and thinking, and conversation carried from earlier turns. Individual findings are often worth cents in a session that cost tens of dollars. Compare each figure with the session's cost before deciding what matters.
- Sessions can share history. A forked session starts with a copy of its parent's conversation. For Pi and Codex forks the report leaves the copied tool runs out of the fork's findings; for other harnesses the same findings can appear in both, so count them once.
- `reconstruction.medianAbsoluteGapPercent` is how far Highwater's reconstruction is from the reported input. If it is above about 10%, treat that session's item figures with caution.

### Findings

| `pattern` | What it means |
| --- | --- |
| `largeLongLivedResult` | One tool result of at least 5,000 tokens stayed in context for at least 10 calls. `facts` has its size, how many calls it was present for, and the tool. |
| `repeatedCommand` (in a session) | The same command, or a read of the same file, ran at least 3 times, or ran again with an identical result. `facts.identicalResults` counts runs whose result matched an earlier one exactly. |
| `repeatedCommand` (across sessions) | The same command or file read in at least 3 sessions. |
| `carriedContext` | At least 25% of the session's input went on conversation (messages, tool results and thinking) added 3 or more user turns earlier. `facts` has the share, the number of user turns and calls, the average context and the number of compactions. |
| `rerunAfterCompaction` | Commands or file reads ran again after a compaction removed their earlier results. `facts.commands` lists those re-run after the most compactions. |

Each finding lists up to three `items` (`itemId`, and `ref` for findings across sessions).

## 4. Look at the evidence

Before recommending a change, look at what the agent actually ran and got back, for the findings you intend to mention:

```bash
highwater show <session ref> '<item ID>' --max-tokens 1500
```

Quote the item ID in single quotes. Check, for example, whether a large result was mostly noise (progress output, a whole file when a few lines were needed), or whether it was needed (the file being edited).

## 5. Work out the suggestions

Prefer a few well-supported suggestions over many weak ones, and start with the largest costs. For each pattern, consider:

- **Carried context.** Usually the largest cost in long sessions: every call sends the whole conversation again, so work from many turns earlier keeps costing after it stops being useful. Suggest starting a new session (or clearing the context) between unrelated tasks, for example after a commit or a merged change; handing a long task over with a short written summary instead of continuing; and using subagents for exploration so that only their conclusions enter the main session. Use `userTurns`, `calls` and `averageContextTokens` to say how long the session ran, and say the saving is an upper bound, since some earlier context is usually still needed.
- **A command family with a large total** (`commandFamilies`). Look at a few of its runs with `show`. Common causes: searches that print whole matching lines from many files (`rg` without `-l`, `--max-count` or a narrower path), status and diff commands run after every step, and full build or test output. Suggest narrower forms, or a script that prints only a summary.
- **Re-runs after a compaction.** The agent read the same files again because the compaction removed them. When the same file is re-read after most compactions, suggest keeping the essential facts in the compaction summary or in a short notes file, splitting a long plan document so that only the current part is read, or ending the session and starting a new one at that point instead.
- **A large share of `assistantMessage` or `thinking` in `contextByKind`.** The agent's own writing is sent again with every later call. Suggest shorter progress messages, and a lower reasoning effort for routine steps where the harness allows it.
- **Large, long-lived results.** A narrower command: `rg -l` or `rg -n` with a pattern instead of `cat`, reading a line range, `git diff --stat` before a full diff, `--quiet` flags, `| tail -n 50` on build and test output, or `jq` to select fields from JSON. Running exploratory work in a subagent, so that only its summary returns to the main session. Starting a new session, or compacting, between unrelated tasks.
- **A command repeated within a session with identical results.** Usually polling or reading the same thing again. Suggest a command that waits instead (for example `gh run watch` instead of repeating `gh run view`), or an instruction to reuse the earlier result.
- **A command or file repeated across sessions.** A candidate for:
  - a skill, or a line in `CLAUDE.md` or `AGENTS.md`, that says how to do the task directly
  - a project script that runs several steps and prints a short summary
  - a smaller document, when the same long file is read at the start of every session
- **Many failed runs of a tool** (`tools[].failed`). A skill or instruction that documents the correct invocation.
- **A large share of `toolDefinition`, `system` or `unrecordedContext` in `contextByKind`.** This is fixed overhead sent with every call. Suggest disabling MCP servers or tools that are not used, or shortening long instruction files. Claude Code does not record its tool definitions, so its fixed overhead appears as `unrecordedContext`.
- **Long chains of tool calls whose intermediate results only feed the next call.** Suggest a script, or Code Mode (programmatic tool calling) where the harness supports it, so the intermediate results never enter the context. The report does not detect these chains yet. Mention them only when the evidence you looked at shows one.

Do not suggest saving tokens by doing the work less carefully, for example by skipping tests or reviews.

## 6. Report back

Write a short summary for the user, most valuable first. For each suggestion give:

1. What you saw, with numbers and the session reference, for example "`cargo test` output (6,400 tokens) stayed in context for 150 calls in claude-code-210a897a9248, about $0.40".
2. The change, made concrete: the exact command, the instruction text, or an outline of the skill or script.
3. A rough saving, and how confident you are in it.

Say once that costs are estimates and, for subscriptions, are API-equivalent.

Then offer to make the changes, such as drafting a skill or editing `CLAUDE.md`. Do not make them without the user's agreement.

The report and `show` output contain commands and parts of their output from the user's sessions. Do not repeat secrets, tokens or personal data from them in your summary.
