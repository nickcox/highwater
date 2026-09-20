# TokenPlume

TokenPlume is a local Context River visualizer for Pi coding-agent JSONL sessions. It reconstructs the active branch and historical model-call context, then lets you follow stable context items through their lifetimes and explicit compaction boundaries.

## Run

```bash
npm --prefix web ci
npm --prefix web run build
cargo run -- --no-open                    # development and debugging
cargo run --release -- --no-open          # large-session validation and normal fast use
# optionally: cargo run --release -- --session-root ~/.pi/agent/sessions --port 43123 --no-open --tokenization auto
```

Tokenization is local and offline. `auto` uses the pinned `o200k_base`/`cl100k_base` tokenizers for recognized OpenAI model families, provider serialization estimates where documented, and a versioned Unicode-character heuristic for unknown models. Use `--tokenization strict` to report unsupported profiles without fallback, `heuristic` to force the fallback, or `off` to disable token analysis. Add `--perf-diagnostics` to emit aggregate stage timings and operation counts without session content.

Open the printed localhost URL. The server binds only to `127.0.0.1` and never modifies session files. Returning to a recently viewed session displays its bounded browser-cached analysis immediately, then conditionally revalidates it in the background with the server ETag. A failed refresh leaves the valid cached view in place and shows a warning.

## Context River interactions

- Move across chart space to move the nearest-call crosshair.
- Click empty chart space or a call label to pin details in the Model call panel.
- Hover a ribbon for a styled context-item inspector; click a ribbon or lifespan segment to enter **Follow Context**.
- Related compaction sources and summaries are highlighted transitively.
- Press `Escape` to clear item selection, then a pinned call, or use **Reset focus**.

Ribbon thickness uses calculated token weights when coverage is complete and best-effort estimated token weights when numeric coverage is partial or heuristic. Genuinely unavailable token geometry is shown explicitly rather than replaced with serialized-byte weights. Serialized size remains available as item diagnostics. Compaction connectors show structural replacement only; their width does not imply token contribution. Provider-reported usage and costs remain separate from calculated context composition.

## Development checks

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test --all-targets
npm --prefix web ci
npm --prefix web run check
npm --prefix web run test
npm --prefix web run build
cargo build --release
```

Build the frontend before Rust so `rust-embed` packages the current `web/dist/` assets into the executable. The generated `web/dist/` assets are tracked so a clean checkout can build the embedded binary without requiring Node at runtime; refresh and commit them whenever the frontend changes.

For generated performance validation, run `scripts/benchmark-context-river.sh large`. It uses only deterministic generated text, reports median cold/warm requests, response bytes, and observed peak RSS, then removes its temporary session root.

## Architecture

- Rust owns source-adapter parsing, branch/context reconstruction, offline tokenization, reconciliation, derived metrics, and the Axum API.
- Source-neutral normalized domain types keep provider usage/costs, calculated estimates, and missing-value semantics distinct.
- TypeScript validates and indexes the normalized analysis response; it does not tokenize or infer missing payloads.
- D3 computes scales and SVG ribbon paths.
- Svelte owns rendering and interaction state.

The primary endpoint is `GET /api/sessions/{id}/analysis`. It contains labels, structural metadata, and bounded reader-facing content previews, but it does not duplicate full raw JSONL records or provider payloads. Top-level `schemaVersion` is the sole public envelope-version marker; the current response schema is version 5. Responses include an ETag and support `If-None-Match` with an empty-body `304 Not Modified` response.
