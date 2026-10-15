# Highwater development

## Requirements

Rust **1.88 or newer**, Node **24 LTS or newer**, npm, Bash, Python 3 and curl.

`Cargo.toml` declares the Rust minimum, and it is tested with 1.88.0: the locked dependencies include `ruzstd`, which needs 1.87, and the pinned `tiktoken` 4.1.2 uses let-chains, which need 1.88. A dependency change must keep this minimum, or raise it and test the new one; the Rust edition alone does not guarantee it.

With Nix, `nix develop` opens a shell with Rust, Node 24, Python 3 and curl, and `nix build` builds the package from `flake.nix` and runs the Rust tests.

## Building

Build the frontend before the Rust binary, because `rust-embed` packs the current `web/dist/` files into the executable. `web/dist/` is committed so that a fresh clone can build the binary without Node; rebuild and commit it whenever the frontend changes.

## Checks

```bash
scripts/check.sh          # locked installs, Rust and frontend checks, live contract, embedded release build
scripts/check.sh --full   # also Chromium, mocked and integrated (debug and release) browser checks, large benchmark
scripts/check.sh --full --skip-rust-checks   # as CI runs it: leaves out rustfmt, clippy and the Rust tests

# Optional focused checks:
scripts/check-contract.sh
rustup toolchain install 1.88.0 --profile minimal --component rustfmt --component clippy
RUSTUP_TOOLCHAIN=1.88.0 scripts/check.sh
```

`.github/workflows/check.yml` runs the Rust checks on 1.88 and stable, and `scripts/check.sh --full --skip-rust-checks` on Node 24, on GitHub Actions. It also runs the Rust tests on macOS and Windows, and builds the Nix package on Linux and macOS. Every check also runs locally.

**Contract check.** `check-contract.sh` runs a test-only Rust exporter that uses the production parser, analyser and serialiser, then passes its 127 fresh outputs to the frontend's production `indexAnalysis` validator. The cases cover every tokenization policy, profile IDs, exposure and economics coverage, summaries at the end of a session, per-call timing and its sources, the largest safe numbers, and totals that exceed them. Controlled estimates go through the same production stages without needing huge test inputs, and invalid inputs must be rejected in Rust before they are exported. The temporary export folder is always removed, and the contract tests fail, rather than skip, when the exports are missing. They have their own Vitest config, so the normal frontend tests never depend on generated files.

**Formatting.** Prettier is configured in `web/.prettierrc.json` for Svelte and TypeScript source, tests and the root TypeScript configs, leaving out the generated `web/dist/`. Run `npm --prefix web run format` to apply it and `npm --prefix web run format:check` to check it.

**Browser tests.** The browser tests use Playwright with Chromium and mocked API responses. Install the browser once with `npm --prefix web run test:browser:install`. To save desktop and narrow screenshots outside the repository, set `HIGHWATER_BASELINE_SCREENSHOTS=/tmp/highwater-browser-baseline` when running `npm --prefix web run test:browser`.

The integrated browser checks run the real server with its embedded frontend. Each uses the debug binary by default, or the release binary when `HIGHWATER_BROWSER_BUILD_PROFILE=release` is set:

- `scripts/browser-smoke-integrated.sh` uses a generated synthetic Pi session, and also checks its cache track and Composition at a pinned call.
- `scripts/browser-smoke-opencode-integrated.sh` generates a separate SQLite database and Pi session, and checks mixed discovery, filtering, OpenCode coverage and cost labels, view links, Composition, refresh after a WAL write, and the narrow layout.
- `scripts/browser-smoke-claude-code-integrated.sh` copies `fixtures/claude-code/projects` to a temporary folder, and checks the Claude Code filter, subagent labels, the coverage notice, API-equivalent cost, the River, Composition, a `304`, the own-total row, a live append and the narrow layout.
- `scripts/browser-smoke-vscode-copilot-integrated.sh` copies `fixtures/vscode-copilot/User` to a temporary folder, builds its trace database from `fixtures/vscode-copilot/traces.sql`, and checks the VS Code Copilot catalogue and filter, calls with and without trace records (timing, recorded cost, coverage note), a Claude call's cache policy and a `304`.

## Releases

`.github/workflows/release.yml` builds release archives for macOS, Linux and Windows. Pushing a tag such as `v0.1.0` checks that the tag matches the version in `Cargo.toml`, builds and packages each binary with the README, licence and changelog, and creates a draft GitHub release with the archives and a `SHA256SUMS` file; write its notes and publish it by hand. Running the workflow by hand from the Actions tab builds the archives without creating a release.

## Price data

The price data for cost estimates is generated, not edited by hand; [data/prices/README.md](../data/prices/README.md) explains how to update it. `scripts/check.sh` runs the generator's tests with `python3 -m unittest discover -s scripts/tests`.

## Benchmarks

Build the release binary first.

- `scripts/benchmark-context-river.sh large` generates a large Pi session, reports median cold and warm request times, response size and peak memory, then removes the session.
- `python3 scripts/benchmark-opencode.py --full` creates synthetic SQLite data only, and checks conditional requests, uncached responses larger than the cache, checkpoints, concurrent reads and 200 WAL commits, then removes the database.
- `python3 scripts/benchmark-claude-code.py` generates a synthetic transcript as large as the largest seen locally, reports cold, cached and conditional request times and peak sampled server memory, then removes it.

To try OpenCode support against a real database, run `node scripts/accept-opencode-readonly.mjs /path/to/opencode.db`. It opens the database through the read-only server and checks one representative session, without taking screenshots or traces, printing transcripts, or writing to the database.
