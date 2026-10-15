# TokenPlume data semantics

What TokenPlume reads, what it calculates itself, what it takes from the usage providers recorded, and how it keeps missing values apart from zeros. For using the interface, see the [user guide](user-guide.md).

## Tokenization

TokenPlume counts tokens locally, without network access. With `--tokenization auto`, the default, it uses:

- the pinned `o200k_base` or `cl100k_base` tokenizer for recognised OpenAI model families;
- a provider's own serialisation estimate where one is documented, as for [Claude models](#claude-models);
- a versioned estimate from the number of Unicode characters for any other model.

GPT-6 models on OpenAI, OpenAI Codex and GitHub Copilot's OpenAI Responses route use `o200k_base` for now. Local counts of text-only output agree with it, but OpenAI has not published which encoding GPT-6 uses. Item counts are estimates either way, not the exact prompt tokens that were billed.

`--tokenization strict` reports models it cannot count instead of falling back to the character estimate, `heuristic` uses the character estimate for everything, and `off` turns token counting off. `--perf-diagnostics` prints how long each stage took and how many operations it ran, without any session content.

### Claude models

Anthropic publishes no tokenizer for Claude 3 or later. TokenPlume counts Claude models with a Rust port of [ctok](https://github.com/sanderland/ctok) (MIT, commit `8c43ffd`), which reconstructs each tokenizer generation from `count_tokens` measurements. The vocabularies are in `data/tokenization/`, converted by `scripts/convert-ctok-vocabulary.py`.

| Topic | Rule |
| --- | --- |
| Matching | A model is matched by its ID whichever provider served it (Anthropic, GitHub Copilot, Bedrock, Vertex and others), after removing route prefixes and suffixes such as `anthropic/`, `us.anthropic.`, `@…`, `-v1:0` and a trailing date. Claude 3 to Opus 4.6 use `ctok-claude-v3`; Opus 4.7 uses `ctok-claude-v4.7`; Opus 4.8 and later, and the Sonnet 5 and Fable models, use `ctok-claude-v4.8`. A Claude model these rules don't cover (for example a new Haiku) uses `ctok-claude-v4.8` with the rule `assumed-latest-claude-ctok`, and the interface says the model has not been measured. Models before Claude 3 keep the character estimate. The method is `apiSerializationEstimate`. |
| Counts | Each item is counted as the content of one message. The fixed tokens Anthropic adds per message (7, 11 or 6 depending on the generation) are not added, because TokenPlume does not know how items are grouped into messages. `scripts/check-claude-tokenizer-parity.py` checks that the port counts exactly as Python ctok does, on ctok's test texts and optionally on local Claude Code texts. |
| Tool calls | A tool call is counted in the form Claude models read it: `<invoke name="…">`, one `<parameter name="…">value</parameter>` line per argument with string values unescaped, and `</invoke>`. Arguments that are not a JSON object are counted as recorded. Counting the arguments' JSON text instead would overestimate them by about 15%, because of the escaping. |
| Thinking | Anthropic keeps a response's thinking in later requests and bills it as input, although a transcript records it only as a summary or not at all. When a response reports its reasoning tokens (Claude Code's `usage.output_tokens_details.thinking_tokens`, or Pi's reasoning count on Claude models), the thinking becomes a separate context item of kind `thinking`, sized by that count (method `reportedUsage`), and the recorded thinking text is no longer counted in the response item. OpenCode records no reasoning count for its Claude messages, so it has no thinking items. Opus 4.5 and later, Sonnet 4.6 and later, Haiku 5.5 and later, and the Fable and Mythos models keep thinking from all earlier turns; earlier models keep it until the next user message. For a call to a different model, the item counts 0 tokens with the note `thinkingNotReadByModel`, because a model does not read another model's thinking. |
| Images | An image whose width and height can be read from its recorded data (PNG, GIF, WebP or JPEG, in Claude Code, Pi, and OpenCode `data:` URLs) is counted by Anthropic's documented rule: scaled down to fit 1,568 px on its longer side (2,576 px from Opus 4.7 and Sonnet 5), then width × height ÷ 750 tokens, at most about 1,600 (4,784). The estimate is partial, with the note `estimatedImageSize`. An image whose size cannot be read stays an `[image]` placeholder, as do images for other models. |
| Unrecorded request content | Claude Code and OpenCode do not record the system prompt or tool definitions they send. So TokenPlume adds an **Unrecorded request context** item (kind `unrecordedContext`) at the first call that reports its input, and again at the first such call after each compaction and each change of model. Failed attempts, such as Claude Code's `<synthetic>` error messages, never reached a model and are skipped. The item is that call's reported input less the estimates of its other items, with the method `reportedUsage` and the note `inferredFromReportedUsage`. It is approximate when one of those estimates is partial, and is left out when the difference is not positive. It stays in context to the end of its segment, so the reported-input comparison is zero at the call where it was measured and then shows how the context drifted from the reported input after that. Pi records its system context and gets no such item (see [Pi system context](sources/pi.md#system-context)). |
| Accuracy | `scripts/measure-claude-usage.py` fits the growth in each call's reported prompt size against the estimates of the items it adds, with image tokens as their own term. On the local sessions measured when this was written, Pi's Claude sessions matched exactly: 1.00 for each kind of item, a median error of 0.5% per step, and nothing left over per tool round trip. Claude Code's matched at 0.97–1.00 per kind, with a median error of 2.9% per step and about 34 tokens left over per tool round trip. With the unrecorded-context item, the median gap per call between reported input and calculated context is 0.1% of the reported input in Claude Code, and 1.2% in OpenCode on Claude models. |

## Sources

Each source has its own reader, described on its own page:

- [Pi](sources/pi.md): JSON Lines session trees, including replayed system prompts and tool definitions.
- [OpenCode](sources/opencode.md): SQLite databases, legacy and modern layouts.
- [Claude Code](sources/claude-code.md): JSON Lines transcripts and subagents.
- [VS Code Copilot Chat](sources/vscode-copilot.md): session files and the trace database.

## Analysis API

### Requests and responses

`GET /api/sessions` lists the sessions TokenPlume found, each with a reference such as `pi-…`, `opencode-…`, `claude-code-…` or `vscode-copilot-…`. `GET /api/sessions/{id}/analysis` returns one session's analysis. The server looks sessions up only by these references: it never accepts a file path or database ID over HTTP, and a reference that matches more than one session is rejected.

The top-level `schemaVersion` is the only version number in the response; the current schema is version 16. Responses have an ETag, and a request with a matching `If-None-Match` gets an empty `304 Not Modified`.

The analysis holds labels, structural metadata, short previews of each item's content, and normalised usage and cost. It does not repeat raw session records or provider payloads.

### Context items

`ContextItem.label` is a short title, also used for accessibility, worded for each source. Pi tool results are labelled from their matching tool call on the selected branch where there is one: **Assistant · write** labels the call, and **Write result · filename** labels its result (likewise Read, Edit, Bash, Grep and Find). Previews are kept separately and are never read back as tool arguments. An image's preview gives the size of its encoded data, usually base64, not of the decoded image.

Each model call lists its context items by position in `contextItems` (`contextItemIndexes`, `addedItemIndexes`, `droppedItemIndexes`), in context order, rather than repeating their IDs; the frontend's `indexAnalysis` turns them back into IDs.

Band heights and Composition use each item's local token estimate, not provider prompt totals. When a session has no token estimates, the chart says so rather than drawing bands from byte sizes. The older `displayWeight` field still holds each item's serialised size in bytes, for diagnostics only.

### Usage and missing values

- Missing counters stay missing: they are never treated as zero or worked out from reasoning text.
- Failed or aborted Pi attempts with default-zero counters keep those zeros in `usage.placeholder`, not as measured usage or cost. Their other counters are unavailable, running totals carry the gap forward, and the reported-input line breaks at them.
- Session totals (`reportedPromptTokens`, `reportedCompletionTokens`, `reportedReasoningTokens`, `reportedCostTotal`) add up the calls that recorded a value. `reportedUsageCoverage` and `reportedCostCoverage` count the calls that recorded one, the failed attempts, and the other calls with nothing recorded, and the summary shows this whenever some are missing.
- The call inspector shows **Recorded output** (`usage.recordedOutput`) and, when present, **Recorded reasoning** (`usage.reasoning`) as the source recorded them, and `usage.outputReasoningRelationship` says whether one includes the other. The details are in the usage disclosure rather than a warning. `usage.output` and `reportedCompletionTokens` stay the normalised completion totals, with reasoning counted exactly once when that is known, and costs, running totals and output rates use them.
- Coverage figures tell apart a recorded zero, a partial figure and an unavailable one. A summary written at the very end of a session can be selected but has no exposure.
- OpenCode, Claude Code and VS Code Copilot responses include `reconstruction: {status: "partial", explanationCodes: [...]}`, listing what the source does not record; Pi responses leave it out.
- `session.harnessSessionCost` is `{totalUsd, sinceMs}` when the harness recorded its own session total (Claude Code's `cost-state`, or VS Code Copilot's credits), and `null` otherwise.
- Known request framing is an approximation for text-only chat routes, not the exact provider serialisation or billing.

### Timing

Each `modelCalls[].timing` keeps `startedAtMs` (when Pi created the assistant message) and `recordedAtMs` (when the entry was saved) as UTC epoch milliseconds, or `null`. Each is kept if valid, even for unknown or custom APIs, and a malformed timestamp becomes `null` without rejecting the session.

For Pi's built-in APIs that TokenPlume has checked, a positive interval between the two gives `durationMs`, with the basis `pi-message-timestamps`. It is the elapsed time the client saw, including waiting, retries and any extension processing, not generation time alone and not the tool calls that followed. A successful response with reported output also gets `effectiveOutputTokensPerSecond = output × 1000 / durationMs`; output already includes reasoning, so it is not added twice. Failed or aborted responses, missing output, missing, reversed or zero intervals, and APIs whose timing has not been checked get no rate. TokenPlume does not work out gaps between messages, time to first token or streaming timing. The call inspector shows the approximate elapsed time and output rate; the absolute times are kept but not shown yet.

### Limits and caching

Integers in the analysis are limited to `Number.MAX_SAFE_INTEGER`, and invalid required values or counts are rejected before a response is sent. A total that would exceed that limit is `null`, never a partial figure.

Three more version numbers identify cached results inside the server and are not part of the response: the output version (35), the tokenization profile version (profile IDs start `profile-v4-`) and the payload fingerprint version (4). Each source identifies a session's content differently:

- **Pi and Claude Code** files by their size and modification time. A rewrite that keeps both can go unnoticed, and file system races are not completely ruled out. Claude Code transcripts add the file kind (main session or subagent).
- **OpenCode** sessions by their database, native session ID and a digest of their content, read in one committed transaction.
- **VS Code Copilot** sessions by the session file's size and modification time, plus a fingerprint of the trace database.

When the server shuts down, it waits a limited time for work in progress, and a scan still running then cannot publish its results.

## Cost assessment

Each model call has a `costAssessment`, and the session has a `costSummary` that keeps billed cost and API-equivalent cost apart. Why the price data is shaped this way is in [data/prices/README.md](../data/prices/README.md#why-costs-are-assessed).

| Billing | Situation | Kind | Amount |
| --- | --- | --- | --- |
| Per token | The harness recorded a cost above $0 | `recorded` | The recorded cost |
| Per token | The recorded cost is $0 or missing, and the provider listed the model at $0 then | `free` | $0 |
| Per token | The recorded cost is $0 or missing, and the provider listed a price then | `estimated` | Token counts × the provider's rate on that date |
| Subscription | Any | `apiEquivalent` | Token counts × the lab's API rate on that date; not a charge |
| Any | No price, time or token counts, or a failed attempt | `unknown` | None |

- **Billing mode** comes from `data/prices/billing-modes.toml`. Pi's `openai-codex` provider is a ChatGPT-plan subscription. GitHub Copilot was a subscription (charged per request) before 1 June 2026, and per token from then. OpenCode records a ChatGPT-plan login under the plain `openai` provider, so an OpenCode `openai` call recorded at $0, at a time when models.dev lists a price for that model, is treated as a subscription, and the call details say so. Claude Code transcripts do not record whether a session used a subscription or an API key. Its `anthropic` calls are treated as a subscription (`apiEquivalent`) and priced at Anthropic's API rate, which is also what an API key pays, so the amount is the same either way; the interface shows them at the API rate without saying which applies. The session summary shows one cost at API rates and splits it into billed and subscription parts only when a session has both.
- **Prices** come from `data/prices/prices.json`, generated from models.dev's git history plus amendments, including corrections converted from wakamex/model-prices; see [data/prices/README.md](../data/prices/README.md). Each rate records when it started and how that date is known: documented, first seen on a pricing page, or the date of a models.dev commit, which can be days after the provider's change. A call before a model's first listed price uses that first price. TokenPlume never downloads prices.
- **The calculation** is uncached input, cache reads, cache writes and output, each times its rate, using whichever long-prompt tier applies. A missing cache rate falls back to the input rate, and one-hour cache writes cost twice the input rate. Output must include reasoning exactly once. When that can't be established for a call (see [OpenCode usage](sources/opencode.md#usage-and-cost)), the amount is a range from output alone to output plus reasoning, shown when the ends differ by at least 1%.
- **Pi's own figure** for subscription calls is kept in `recordedByHarness` but not used as the amount, so Pi and OpenCode calls are priced the same way. Pi recorded its figure at the time of the call with its own rates, which can differ: for example, for GPT-5.6 Sol calls after OpenAI's price cut on 21 August 2026.
- `reportedCostTotal` and `reportedCostCoverage` are unchanged by all this: they are the costs the harness recorded.

## Cache and cost policies

A cache policy says how a provider's usage counters add up to the prompt, so the Cache & cost track can show cache reads, writes and fresh input. Model names alone never select a policy.

- **Claude Code** calls use `anthropic-messages-cache-v1`: prompt tokens are uncached input + cache reads + cache writes. Pi's rules for recorded cost components don't apply, because Claude Code records no cost.
- **GitHub Copilot's `openai-responses` route** has its own three-bucket policy: prompt tokens are uncached input + cache reads + cache writes. A missing bucket makes the call incomplete rather than zero, and a call with a recorded prompt of zero has no ratios. Pi's cost components, worked out from its configured rates, are shown when all of them are recorded, but they are not Copilot subscription charges, premium-request counts or invoices.
- **Direct OpenAI** policies treat older adapters' missing cache writes with caution, and reject a positive cache-write count where none is expected.

Pi's cost-component rules were checked against Pi 0.78.0's provider adapters and may not hold for other versions.
