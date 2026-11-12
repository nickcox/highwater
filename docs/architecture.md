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
- **Commands:** `src/main.rs` runs `serve` (the server, and the default command), `report`, `show` and `skill`. `serve`'s options are also accepted without the command, but only `serve --help` lists them.
- **Reports:** `src/report/` runs `highwater report`, `show` and `skill` without starting the server. It reads the catalogue once through the same discovery code, analyses the chosen sessions on one thread per processor, and builds its report from the normalised sessions and their analyses. See [Token reports](report.md).

## Frontend

- TypeScript validates and indexes the analysis response. It never counts tokens or fills in missing values.
- D3 computes the scales, the SVG band paths and the Composition treemap layout.
- Svelte renders the page and holds the interaction state.
- `SessionView.svelte` owns the summary, charts, inspector, lifespans and interaction state. The standalone `App.svelte` owns session discovery, the title bar, theme controls, errors and page-address handling.
- `web/src/embed.ts` mounts the same session view in a shadow root. Its caller supplies analyses and a Light or Dark palette; the embedded view does not discover sessions or change the page address. Refreshes validate and index new analyses, preserving interaction state only when the native session ID is unchanged. Its Follow latest control navigates to the newest calls until a call is pinned.
- Responsive rules use the named `highwater` container, rather than the browser's width. Shared styles and palette declarations stay inside the embedded shadow root. DOM lookups use the owning root, so multiple mounted views can keep their focus and selections independent.

## bb integration (in development)

`integrations/bb/` is a separate TypeScript package. Its host entry starts one private Highwater process on the agent's machine and uses the existing catalogue and analysis API. It verifies session references against that catalogue, computes small summaries and prepares gzip transfers with bounded pieces, memory use and expiry. Concurrent row/tab requests share startup, catalogue validation and analysis work. The process and its in-memory transfers stop with the host worker.

The server entry resolves a thread's latest identity and environment on every request, invalidating an older identity after a completed context clear. Its HTTP route joins bounded gzip transfers and preserves ETags and analysis errors; its RPC returns summaries with bb's current context usage. Both accept only thread IDs. Thread events publish refresh signals without storing mappings or starting background work. The Context tab mounts the shared view inside a shadow root. One per-thread scheduler shares analysis responses between visible instances, retains pending signals and pauses when no view is visible. Hidden tabs retain their interaction state; a changed native session ID resets it. The compact Context row is a later milestone. No bb types or identifiers are passed to the Rust server. The listening stdout line has a format test because clients use it to discover an ephemeral port.

## Live updates

`GET /api/sessions` returns the current catalogue, with its generation, revision, availability and ETag in headers. `GET /api/events` sends Server-Sent Events that carry no session content and only say that something changed; the browser then fetches the catalogue again rather than treating the events as a log.

Discovery is local and keeps working over plain HTTP when Server-Sent Events or file watching are unavailable. If a readable session folder cannot be watched, the server starts in a degraded mode and refreshes the catalogue, within limits, when requests arrive. OpenCode databases are also polled every two seconds, which also catches a watched folder being replaced. A source that fails briefly recovers after its next successful scan without affecting watchers that work. A watcher that is lost stays marked as degraded until the server restarts, while polling and request-driven refreshes carry on.
