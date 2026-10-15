# Highwater architecture

Highwater is a Rust server with an embedded Svelte frontend.

## Rust server

The server reads session files, rebuilds each model call's context, counts tokens, compares the counts with the usage providers recorded, works out the derived metrics and costs, and serves the results over an Axum HTTP API.

- **One reader per source:** `src/pi/` (JSON Lines), `src/opencode/` (SQLite), `src/claude_code/` (JSON Lines records, with active-branch selection and reconstruction in separate modules) and `src/vscode_copilot/` (session file replay and the trace database). Their formats are described in [docs/sources](sources/). Each reader produces the same normalised types, which keep provider usage and costs, local estimates, and missing values apart.
- **Loading:** `src/source.rs` loads a session from the locator the catalogue holds for it, so a file path never comes from an HTTP request. Claude Code files use the same file fingerprint and analysis path as Pi files.
- **Pi:** the session's entry graph is checked and interpreted into typed entries before the context is rebuilt with stable item positions.
- **Analysis:** the normalised session's references, presences and integers are validated first. A preparation stage then plans one estimate for each distinct item and tokenizer profile, and the per-call and per-item results and the response are built from that plan.
- **Catalogue:** scheduling (debouncing, retries, rate limits and shutdown) is separate from discovery.
- **Analysis service:** one service holds the response cache (4 entries, 16 MiB) and the analyses in progress behind one short lock, and runs at most two analyses at a time. A request joins an analysis already in progress for the same session, and that analysis finishes even if the request that started it is cancelled. Failures are typed and mapped to HTTP responses in one place, and reporting a failure can never leave a finished analysis unpublished. These limits cover the response cache and concurrency, not the process's total memory.
- Analyses are not saved between runs, and a session that changes is analysed again in full.

## Frontend

- TypeScript validates and indexes the analysis response. It never counts tokens or fills in missing values.
- D3 computes the scales, the SVG band paths and the Composition treemap layout.
- Svelte renders the page and holds the interaction state.

## Live updates

`GET /api/sessions` returns the current catalogue, with its generation, revision, availability and ETag in headers. `GET /api/events` sends Server-Sent Events that carry no session content and only say that something changed; the browser then fetches the catalogue again rather than treating the events as a log.

Discovery is local and keeps working over plain HTTP when Server-Sent Events or file watching are unavailable. If a readable session folder cannot be watched, the server starts in a degraded mode and refreshes the catalogue, within limits, when requests arrive. OpenCode databases are also polled every two seconds, which also catches a watched folder being replaced. A source that fails briefly recovers after its next successful scan without affecting watchers that work. A watcher that is lost stays marked as degraded until the server restarts, while polling and request-driven refreshes carry on.
