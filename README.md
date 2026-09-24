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

- Move across chart space to move the nearest-call crosshair. Click empty chart space or a call label to pin call details; click a ribbon or lifespan segment to select a context item. Hover previews are supplementary.
- The toolbar shows the visible call range, zoom controls, **Fit all**, and **Latest**. Open **Go to…** for labelled call-jump and range-zoom forms. Escape closes this disclosure and restores focus to its summary.
- The chart's Y-axis shows readable stack-weight ticks and units. **Session scale** is the default and keeps heights comparable across the session; opt-in **Visible calls** uses visible call columns plus interpolated viewport-edge samples, so ribbon heights change as you pan or zoom. Always read the current axis before comparing heights. When token geometry is unavailable, the axis explicitly describes structural placeholder weight rather than tokens.
- Range, pan, and pinch gestures are isolated in a small transition module. Pointer cancellation/lost capture, release outside the plot, window blur, and component teardown clear the gesture without leaving a stale drag or changing selection.
- The session summary keeps model-call count, context-item count, peak calculated context, reported cost, and a token-estimate caveat visible. Open **Session details** for provider usage, compactions, tokenization coverage, reconciliation, model/provider, and session metadata.
- Call and item panels keep key values and actions visible; usage breakdowns, token diagnostics, profiles, and technical identifiers use native disclosures. Copy buttons provide feedback for IDs.
- On wide screens, the Context River and full-session lifespan list share the main column, with a bounded sticky call/item inspector alongside them. On narrow screens the inspector follows the chart; **View details** deliberately moves focus there without opening or scrolling on hover/selection.
- Lifespan browsing searches source labels and bounded previews (up to 120 characters), filters by item kind, and sorts by token-turn exposure, size, or first appearance. Size uses one shared token-estimate profile with the widest numeric coverage; missing estimates sort last. The call axis and compaction markers describe the full session independently of chart zoom. Items without call presence, including terminal summaries, remain selectable.
- **Selected item** identifies and outlines only the exact ribbon. Compaction lineage remains available through direct connectors, item details, and lineage actions; sibling sources are not treated as one visual selection group, and other ribbons stay at normal opacity.
- Press `Escape` to clear the selected item, then a pinned call. **Clear selected item and pinned call** clears both at once.

Ribbon thickness uses calculated token weights when coverage is complete and best-effort estimated token weights when numeric coverage is partial or heuristic. Genuinely unavailable token geometry is shown explicitly rather than replaced with serialized-byte weights. Serialized size remains available as item diagnostics. Compaction connectors show structural replacement only; their width does not imply token contribution. Provider-reported usage and costs remain separate from calculated context composition.

## Development checks

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test --all-targets
npm --prefix web ci
npm --prefix web run format:check
npm --prefix web run check
npm --prefix web run test
npm --prefix web run build
npm --prefix web run test:browser:install
npm --prefix web run test:browser
scripts/browser-smoke-integrated.sh
cargo build --release
```

Frontend formatting is configured in `web/.prettierrc.json` for Svelte and TypeScript source, tests, and root TypeScript configs; generated `web/dist/` assets are excluded. Run `npm --prefix web run format` to apply it and `npm --prefix web run format:check` to verify it.

The browser smoke suite uses Playwright/Chromium and deterministic mocked API responses. Install its browser once with `npm --prefix web run test:browser:install`. `scripts/browser-smoke-integrated.sh` additionally builds and checks the Rust-served embedded frontend against a generated sanitized session. To save desktop and narrow baseline screenshots outside the repository, set `TOKENPLUME_BASELINE_SCREENSHOTS=/tmp/tokenplume-browser-baseline` when running `npm --prefix web run test:browser`.

Build the frontend before Rust so `rust-embed` packages the current `web/dist/` assets into the executable. The generated `web/dist/` assets are tracked so a clean checkout can build the embedded binary without requiring Node at runtime; refresh and commit them whenever the frontend changes.

For generated performance validation, run `scripts/benchmark-context-river.sh large`. It uses only deterministic generated text, reports median cold/warm requests, response bytes, and observed peak RSS, then removes its temporary session root.

## Architecture

- Rust owns source-adapter parsing, branch/context reconstruction, offline tokenization, reconciliation, derived metrics, and the Axum API.
- Source-neutral normalized domain types keep provider usage/costs, calculated estimates, and missing-value semantics distinct.
- TypeScript validates and indexes the normalized analysis response; it does not tokenize or infer missing payloads.
- D3 computes scales and SVG ribbon paths.
- Svelte owns rendering and interaction state.

The primary endpoint is `GET /api/sessions/{id}/analysis`, where `id` is the URL-encoded canonical session path returned by `GET /api/sessions`. It contains labels, structural metadata, and bounded reader-facing content previews, but it does not duplicate full raw JSONL records or provider payloads. `ContextItem.label` is a bounded source-aware title/accessibility label; Pi tool results use their matching selected-branch invocation when available, while previews remain separate content and are never reinterpreted as arguments. Top-level `schemaVersion` is the sole public envelope-version marker; the current response schema is version 5. Responses include an ETag and support `If-None-Match` with an empty-body `304 Not Modified` response.

`GET /api/sessions` returns the current catalogue with generation, revision, availability, and ETag headers. `GET /api/events` provides content-free SSE invalidation hints; browsers refetch the catalogue rather than treating SSE as an event log. Live discovery is local and remains usable through ordinary HTTP when SSE or filesystem watching is unavailable. If filesystem watching cannot be initialized for an existing readable root, the server starts in degraded mode and performs bounded request-driven catalogue refreshes.
