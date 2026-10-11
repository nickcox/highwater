# TokenPlume development

Use Rust **1.88 or newer**, Node **24 LTS or newer**, npm, Bash, Python 3, and curl. The Rust minimum is declared in `Cargo.toml` and tested with 1.88.0: the locked dependency graph includes `ruzstd` requiring 1.87, and pinned `tiktoken` 4.1.2 uses let-chains requiring 1.88. Dependency changes must preserve this floor or explicitly advance and test it; the edition alone does not establish compatibility.

```bash
scripts/check.sh          # locked installs, Rust/frontend checks, live contract, embedded release build
scripts/check.sh --full   # also Chromium, mocked + debug/release integrated browser checks, large benchmark

# Optional focused checks:
scripts/check-contract.sh
rustup toolchain install 1.88.0 --profile minimal --component rustfmt --component clippy
RUSTUP_TOOLCHAIN=1.88.0 scripts/check.sh
```

`check-contract.sh` runs a test-only Rust producer using the production parser/analyzer/serializer, then passes 127 fresh checked-in/synthetic outputs to the production TypeScript `indexAnalysis` validator. Cases cover all tokenization policies, opaque profile identities, exposure/economics coverage, terminal summaries, per-call timing/provenance, safe-number boundaries, and aggregate exhaustion. Controlled estimates use the same production derivation stages without giant test payloads; invalid source/normalized inputs must fail in Rust before export. The temporary export directory is always removed, and the contract suite fails rather than silently skipping when exports are missing. Its standalone Vitest config keeps normal frontend tests independent of generated files.

`.github/workflows/check.yml` defines Rust 1.88/stable checks and full Node 24 contract/browser validation on GitHub Actions. Local checks are independently reproducible; a newly added workflow is not evidence that a remote CI run has completed.

Frontend formatting is configured in `web/.prettierrc.json` for Svelte and TypeScript source, tests, and root TypeScript configs; generated `web/dist/` assets are excluded. Run `npm --prefix web run format` to apply it and `npm --prefix web run format:check` to verify it.

The browser smoke suite uses Playwright/Chromium and deterministic mocked API responses. Install its browser once with `npm --prefix web run test:browser:install`. `scripts/browser-smoke-integrated.sh` builds and checks the Rust-served embedded frontend against a generated sanitized session; it uses the debug binary by default, or the release binary when `TOKENPLUME_BROWSER_BUILD_PROFILE=release` is set. The integrated path also exercises the generated session's cache track and pinned-call Composition. `scripts/browser-smoke-opencode-integrated.sh` generates an isolated SQLite database plus Pi session and checks mixed discovery, filtering, OpenCode coverage/cost labels, links, Composition, WAL refresh, and narrow layout; it supports the same debug/release switch. `scripts/browser-smoke-claude-code-integrated.sh` copies `fixtures/claude-code/projects` to a temporary directory and checks the Claude Code filter, subagent labels, coverage notice, API-equivalent cost, River, Composition, a `304`, the own-total row, a live append and narrow layout, with the same switch. To save desktop and narrow baseline screenshots outside the repository, set `TOKENPLUME_BASELINE_SCREENSHOTS=/tmp/tokenplume-browser-baseline` when running `npm --prefix web run test:browser`.

Build the frontend before Rust so `rust-embed` packages the current `web/dist/` assets into the executable. The generated `web/dist/` assets are tracked so a clean checkout can build the embedded binary without requiring Node at runtime; refresh and commit them whenever the frontend changes.

Price data for cost estimates is generated, not edited: see [data/prices/README.md](../data/prices/README.md) for how to update it. `scripts/check.sh` runs the generator's tests with `python3 -m unittest discover -s scripts/tests`.

For OpenCode HTTP/WAL/RSS validation, run `python3 scripts/benchmark-opencode.py --full` after a release build. It creates only synthetic SQLite data, checks conditional freshness, oversized uncached responses, checkpoints, concurrent reads and 200 WAL commits, and removes its temporary database. Optional real-source browser acceptance is `node scripts/accept-opencode-readonly.mjs /path/to/opencode.db`: it opens the database through the read-only server and checks a representative qualified session without screenshots, traces, transcript dumps, or database writes.

For Claude Code, `python3 scripts/benchmark-claude-code.py` (after a release build) generates a synthetic transcript as large as the largest seen locally, and reports cold, cached and conditional request times and peak sampled server memory, then removes it.

For generated performance validation, run `scripts/benchmark-context-river.sh large`. It uses only deterministic generated text, reports median cold/warm requests, response bytes, and observed peak RSS, then removes its temporary session root.
