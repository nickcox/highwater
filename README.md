# TokenPlume

TokenPlume is a local Context River visualizer for Pi coding-agent JSONL sessions. It reconstructs the active branch and historical model-call context, then lets you follow stable context items through their lifetimes and explicit compaction boundaries.

## Run

```bash
npm --prefix web ci
npm --prefix web run build
cargo run                                  # development and debugging
cargo run --release                        # large-session validation and normal fast use
# optionally: cargo run --release -- --session-root ~/.pi/agent/sessions --port 43123 --tokenization auto
```

Tokenization is local and offline. `auto` uses the pinned `o200k_base`/`cl100k_base` tokenizers for recognized OpenAI model families, provider serialization estimates where documented, and a versioned Unicode-character heuristic for unknown models. GPT-6-family models on OpenAI/OpenAI Codex (and GitHub Copilot's OpenAI Responses route) provisionally use `o200k_base`: local text-only output counts support this choice, but OpenAI has not published a GPT-6 encoding mapping. Calculated item counts remain estimates, not exact billed prompt tokens. Use `--tokenization strict` to report unsupported profiles without fallback, `heuristic` to force the fallback, or `off` to disable token analysis. Add `--perf-diagnostics` to emit aggregate stage timings and operation counts without session content.

Open the printed localhost URL. The server binds only to `127.0.0.1` and never modifies session files. Returning to a recently viewed session displays its bounded browser-cached analysis immediately, then conditionally revalidates it in the background with the server ETag. A failed refresh leaves the valid cached view in place and shows a warning.

## Context River interactions

- Move across chart space to move the nearest-call crosshair. Click empty chart space or a call label to pin call details; click a ribbon to select a context item. Hover previews are supplementary.
- The toolbar shows the visible call range, equal-sized **‹ / ›** call-selection buttons, zoom controls, **Fit all**, and **Latest**. Stepping preserves the selected item (including when absent at the new pin) and zoom, nudging the target into view only near/outside a viewport edge. Without a pin, the fresh/Fit all overview starts Next at the first call and disables Previous; a zoomed/scrolled view steps from its nearest centre call. Use **← / →** to step calls, or **h / l** while the River workspace has focus. Text entry, composition/IME, modifier shortcuts and tab navigation retain their own keys; Composition does not intercept these call shortcuts. Exact call-jump and range-zoom forms are secondary tools under **View options**; Escape closes the disclosure and restores summary focus.
- **View options** contains vertical scale, Balanced/Compact layout, and Items/Item types display. The chart's Y-axis shows readable stack-weight ticks and units. **Session scale** is the fresh default and keeps heights comparable across the session; opt-in **Visible calls** uses visible call columns plus interpolated viewport-edge samples, so ribbon heights change as you pan or zoom. Always read the current axis before comparing heights. When token geometry is unavailable, the axis explicitly describes structural placeholder weight rather than tokens.
- Range, pan, and pinch gestures are isolated in a small transition module. Pointer cancellation/lost capture, release outside the plot, window blur, and component teardown clear the gesture without leaving a stale drag or changing selection.
- The session summary keeps model-call count, context-item count, peak calculated context, and **Pi-calculated cost** visible. This cost is based on Pi's configured model rates, not a provider invoice. Open **Session details** for provider usage, compactions, tokenization coverage, reconciliation, model/provider, and session metadata.
- Call and item panels keep key values and actions visible; usage breakdowns, token diagnostics, profiles, and technical identifiers use native disclosures. Copy buttons provide feedback for IDs.
- On wide screens, the Context River and full-session lifespan list share the main column. A compact, bounded sticky call/item inspector appears alongside them only when an item or call is selected. Content preview, estimate basis, diagnostics and identifiers remain independently available; section choices survive panel remounts within the session. **View details** deliberately reveals and focuses the selected item's summary inside that inspector; with no selection it focuses the inspector prompt. Hover and selection never open or scroll it implicitly.
- **Composition** is a separate tab that starts in **Cumulative** scope, with **At call** available for point-in-time estimates. Cumulative values are estimated token-turns: each present item's applicable estimate is added once per model call through the pinned endpoint, or across the whole session when unpinned. This measures input-context exposure, not unique content, provider usage, billed tokens, or cost. Treemap area and shares use available scoped estimates; missing and partial coverage stays qualified, while zero/unavailable/tiny contributors remain inspectable in the complete ranked **List**. Provider prompt counts, known request framing, and reconciliation details remain separate and are compared only at call scope.
- Lifespan browsing searches source labels and bounded previews (up to 120 characters), filters by item kind, and sorts by token-turn exposure, size, or first appearance. Size uses one shared token-estimate profile with the widest numeric coverage; missing estimates sort last. The call axis and compaction markers describe the full session independently of chart zoom. With no filters, the disclosure shows one total item count; filtered results show the available/total count. Click/tap a position on a lifespan segment to select its item and pin the nearest real call within that segment. Item-label clicks and keyboard Enter/Space select only the item, preserving the pin; items without call presence, including terminal summaries, remain selectable without inventing a call. These actions do not switch views or automatically pan/zoom River.
- **Selected item** identifies and outlines only the exact ribbon. Compaction lineage remains available through direct connectors, item details, and lineage actions; sibling sources are not treated as one visual selection group, and other ribbons stay at normal opacity.
- Press `Escape` to close an active disclosure/overlay first, including expanded **Cache & cost** (focus returns to its trigger). Subsequent presses clear the selected item, then the pin, then restore Fit all. **Clear selected item and pinned call** clears both at once.

**Cache & cost** starts collapsed for fresh preferences. Expand it for **Cache / Cost / Off** and **Tokens / Share (%)**; collapse/Off retains the last mode and cache view. Explicit River/economics preferences are remembered across sessions and reloads in one bounded, versioned localStorage entry (enums/booleans only; no session identities, content, selection or navigation). **Reset view preferences** resets only those settings. Blocked storage leaves the in-memory UI usable.

The **Cache / Cost / Off** track reports only policy-supported, provider-usage-derived cache buckets and Pi-calculated per-call totals. Cache ratios and cost are not assigned to individual items; unsupported, missing, partial, and measured-zero data remain distinct. The mode controls and compact legend sit beside the economics plot; its exact readout is a normal-flow chart footer that remains aligned while the River pans. The track keeps quantitative marks on the shared call axis and places compaction, target-change, and cache-share observations in a bounded event lane with explicit event counts, keyboard/touch details, and exact call mappings. Ribbon thickness and Composition use local item token estimates, not provider prompt totals. Genuinely unavailable token geometry is shown explicitly rather than replaced with serialized-byte weights. The legacy `displayWeight` field remains a serialized-byte diagnostic, never a token-geometry fallback. Image previews identify encoded source-data size (usually base64), not decoded image bytes. Compaction connectors show structural replacement only; their width does not imply token contribution. These economics mappings are audited against Pi v0.78.0 adapters and should not be read as universal provider semantics.

## Development checks

Use Rust **1.88 or newer**, Node **24 LTS or newer**, npm, Bash, Python 3, and curl. The Rust minimum is declared in `Cargo.toml` and tested with 1.88.0: the locked dependency graph includes `ruzstd` requiring 1.87, and pinned `tiktoken` 4.1.2 uses let-chains requiring 1.88. Dependency changes must preserve this floor or explicitly advance and test it; the edition alone does not establish compatibility.

```bash
scripts/check.sh          # locked installs, Rust/frontend checks, live contract, embedded release build
scripts/check.sh --full   # also Chromium, mocked + debug/release integrated browser checks, large benchmark

# Optional focused checks:
scripts/check-contract.sh
rustup toolchain install 1.88.0 --profile minimal --component rustfmt --component clippy
RUSTUP_TOOLCHAIN=1.88.0 scripts/check.sh
```

`check-contract.sh` runs a test-only Rust producer using the production parser/analyzer/serializer, then passes 65 fresh checked-in/synthetic outputs to the production TypeScript `indexAnalysis` validator. Cases cover all tokenization policies, opaque profile identities, exposure/economics coverage, terminal summaries, safe-number boundaries, and aggregate exhaustion. Controlled estimates use the same production derivation stages without giant test payloads; invalid source/normalized inputs must fail in Rust before export. The temporary export directory is always removed, and the contract suite fails rather than silently skipping when exports are missing. Its standalone Vitest config keeps normal frontend tests independent of generated files.

`.github/workflows/check.yml` defines Rust 1.88/stable checks and full Node 24 contract/browser validation on GitHub Actions. Local checks are independently reproducible; a newly added workflow is not evidence that a remote CI run has completed.

Frontend formatting is configured in `web/.prettierrc.json` for Svelte and TypeScript source, tests, and root TypeScript configs; generated `web/dist/` assets are excluded. Run `npm --prefix web run format` to apply it and `npm --prefix web run format:check` to verify it.

The browser smoke suite uses Playwright/Chromium and deterministic mocked API responses. Install its browser once with `npm --prefix web run test:browser:install`. `scripts/browser-smoke-integrated.sh` builds and checks the Rust-served embedded frontend against a generated sanitized session; it uses the debug binary by default, or the release binary when `TOKENPLUME_BROWSER_BUILD_PROFILE=release` is set. The integrated path also exercises the generated session's cache track and pinned-call Composition. To save desktop and narrow baseline screenshots outside the repository, set `TOKENPLUME_BASELINE_SCREENSHOTS=/tmp/tokenplume-browser-baseline` when running `npm --prefix web run test:browser`.

Build the frontend before Rust so `rust-embed` packages the current `web/dist/` assets into the executable. The generated `web/dist/` assets are tracked so a clean checkout can build the embedded binary without requiring Node at runtime; refresh and commit them whenever the frontend changes.

For generated performance validation, run `scripts/benchmark-context-river.sh large`. It uses only deterministic generated text, reports median cold/warm requests, response bytes, and observed peak RSS, then removes its temporary session root.

## Architecture

- Rust owns source-adapter parsing, branch/context reconstruction, offline tokenization, reconciliation, derived metrics, and the Axum API.
- Pi graph validation and typed interpretation precede stable-index reconstruction and finalization. Normalized references, presence, and raw safe integers are validated before a borrowed preparation stage plans unique item/profile estimates; call/item derivation and DTO assembly reuse that plan.
- Catalogue scheduling owns debounce/retry/rate/shutdown decisions independently of discovery. One analysis service owns the four-entry/16-MiB response cache and active flights under one short lock, with at most two blocking analysis jobs. Flights register before permit acquisition and survive request cancellation; typed shared failures map centrally, and best-effort category reporting cannot strand a completed flight. These are response-cache/concurrency limits, not total process-memory bounds.
- Source-neutral normalized domain types keep provider usage/costs, calculated estimates, and missing-value semantics distinct.
- TypeScript validates and indexes the normalized analysis response; it does not tokenize or infer missing payloads.
- D3 computes scales, SVG ribbon paths, and the Composition treemap layout.
- Svelte owns rendering and interaction state.

The primary endpoint is `GET /api/sessions/{id}/analysis`, where `id` is the URL-encoded canonical session path returned by `GET /api/sessions`. It contains labels, structural metadata, bounded reader-facing content previews, and normalized economics, but it does not duplicate full raw JSONL records or provider payloads. `ContextItem.label` is a bounded source-aware title/accessibility label; Pi tool results use their matching selected-branch invocation when available: **Assistant · write** labels the request, while **Write result · filename** labels the returned result (likewise Read, Edit, Bash, Grep and Find). Previews remain separate content and are never reinterpreted as arguments. Top-level `schemaVersion` is the sole public envelope-version marker; the current response schema is version 7. Responses include an ETag and support `If-None-Match` with an empty-body `304 Not Modified` response.

Raw public analysis integers are limited to `Number.MAX_SAFE_INTEGER`; invalid source/normalized values are rejected before successful serialization. Derived range exhaustion remains qualified `null`, never a recovered total or misleading subtotal. Exposure coverage distinguishes an observed numeric zero, partial available observations, and unavailable values; terminal summaries are structural/selectable but have no fabricated exposure. Known request framing is a text-only approximation for supported chat routes, not universal provider serialization or billing.

Internal output/cache identity is **11**, tokenization profile identity is **v4** (opaque, delimiter-safe IDs preserving absent versus literal target values), and payload fingerprint encoding remains **3**. These are not additional public envelope-version fields. Source verification retains size/mtime identity: rewrites preserving both can escape detection, and filesystem races are not completely eliminated. Shutdown drain timeouts acknowledge that blocking work may remain; detached scan results cannot publish after shutdown.

The completed implementation and validation evidence are recorded in [backend maintainability notes](plans/backend-maintainability-notes.md), following the [milestone plan](plans/backend-maintainability-implementation-plan.md). Persistence and incremental analysis remain deferred rather than being implied by these changes.

`GET /api/sessions` returns the current catalogue with generation, revision, availability, and ETag headers. `GET /api/events` provides content-free SSE invalidation hints; browsers refetch the catalogue rather than treating SSE as an event log. Live discovery is local and remains usable through ordinary HTTP when SSE or filesystem watching is unavailable. If filesystem watching cannot be initialized for an existing readable root, the server starts in degraded mode and performs bounded request-driven catalogue refreshes.
