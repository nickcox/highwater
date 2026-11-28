# Required source locators: final verification

## Scope

Reviewed the combined uncommitted implementation against `docs/plans/required-source-locators.md`. No public schema, endpoint, session-reference hash, analysis version or parity digest changed. File loading now requires the discovered native path and reader; OpenCode uses its committed snapshot identity. Literal analysis ETags intentionally change; catalogue list validators retain their existing generation/revision behaviour.

This verification step adds `missing_file_never_returns_a_cached_not_modified` in `src/server/tests.rs` and clarifies upgrade behaviour in `docs/architecture.md`. The new test warms the HTTP analysis cache, deletes the source and requires 404 rather than stale 304. The existing source fingerprint descriptions in `docs/sources/claude-code.md` and `docs/sources/vscode-copilot.md` remain accurate.

## Acceptance coverage reviewed

- Mandatory locators, exhaustive harness mapping, all six source fixtures, private-field omission, startup summaries and unchanged session relationships are covered by server tests. Pi deduplication uses native paths rather than display strings.
- Executor tests check that the supplied locator, not the key reader, controls loading, and that injected execution receives the original path.
- Typed-key tests compare equality and ETags across readers, Claude subtypes, file stamps, auxiliary fingerprints, database IDs/revisions and response options. Performance diagnostics remain excluded. Unix native-byte and field-boundary tests run on macOS.
- Existing file-change, concurrency, cancellation, panic, retry, oversized-response and eviction coverage remains. OpenCode HTTP tests check committed snapshots, unchanged 304, changed 200, WAL updates, busy/checkpoint and deletion cases. Sidecar key tests cover trace and workspace changes.
- Report/show/turns, item-content, analysis contract, usage export, source loading and session totals are exercised by the Rust suite. No analysis parity expectations were changed.
- `pi_discovery_retains_non_utf8_native_path` is Linux-only. It checks discovery and loading under a non-UTF-8 parent; it was reviewed but is compiled out on macOS, not counted among ignored tests. Linux execution remains outstanding.

## Environment and commands

The host is macOS. Rust is absent from the ordinary PATH. Checks ran through the documented `nix develop --command bash -c ...` environment, with Rust 1.98.1 and Node 24.21.0. `web/dist` was already present. This verifies the combined implementation, not a rerun of the original pre-implementation baseline or the minimum Rust version.

Results:

- `cargo test --locked server::`: 121 passed.
- `cargo test --locked report::`: 42 passed.
- `scripts/check.sh`: Rust formatting, Clippy with warnings denied and all-target tests passed (540 passed, 5 ignored). Embed consistency, 19 Python tests, frontend formatting and Svelte checks passed. Frontend unit tests had 609 passed and 1 failed, stopping the script before contract and release checks.
- The frontend unit failure reproduces in isolation: `SessionPicker.test.ts`, combined-cost assertion expects `$4.00`, but the unchanged UI displays separate `$3.00` and `$1.00` rows. No frontend files changed in this implementation.
- The remaining ordinary checks were run separately: live backend/frontend contract passed (162 frontend assertions), frontend build passed, and `cargo build --release --locked` passed.
- Mocked Chromium browser suite: 101 passed. Integrated Pi: 3 passed in each of debug and release. Integrated VS Code Copilot: 1 passed in each of debug and release.
- Integrated debug OpenCode: 2 passed, 1 failed. The mixed-source case passed its analysis/WAL checks, then could not find the Harness control after changing to a narrow viewport.
- Integrated debug Claude Code: 1 passed, 1 failed. The catalogue case matched a parent row by the subagent prompt text, then incorrectly expected that row to be absent before enabling child sessions.

All three failing cases were reproduced against a clean archive of `HEAD` under the ignored `target/locator-verification-baseline/` directory, using the same environment and browser dependencies. The baseline OpenCode and Claude Code cases fail at the same assertions. These are existing test/UI mismatches, not regressions introduced by the combined implementation; no unrelated corrections were made. Baseline focused frontend results were 9 passed and 1 failed.

The five ignored Rust tests require local OpenCode data, local Codex sessions, local Claude usage data, explicitly configured totals logs, or generated Claude tokenizer parity cases. They were not enabled.

`scripts/check.sh` does not run browsers by default. `--full` additionally runs BB plugin checks, browser installation and mocked tests, integrated debug/release checks and performance benchmarks. Focused browser checks were added here because catalogue and analysis consumers changed. The entire `--full` suite, BB plugin tests and performance benchmarks were not run; no frontend, plugin or performance-policy changes are included.

## Outstanding checks

The ordinary script is not green because of the pre-existing frontend unit failure. The two pre-existing browser failures also prevent claiming a green full suite. Their assertions need separate maintenance. OpenCode and Claude Code integrated release cases were not run after reproducing the same failures on the baseline. Run the Linux native-path case on Linux. No commits, pushes or PRs were created, and the implementation plan was not edited.
