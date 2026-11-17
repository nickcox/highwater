# Highwater development

## Requirements

Rust **1.88 or newer**, Node **24 LTS or newer**, npm, Bash, Python 3, curl and rsync.

`Cargo.toml` declares the Rust minimum, and it is tested with 1.88.0: the locked dependencies include `ruzstd`, which needs 1.87, and the pinned `tiktoken` 4.1.2 uses let-chains, which need 1.88. A dependency change must keep this minimum, or raise it and test the new one; the Rust edition alone does not guarantee it.

With Nix, `nix develop` opens a shell with Rust, Node 24, Python 3, curl and rsync, and `nix build` builds the package from `flake.nix` and runs the Rust tests.

## Building

Build the frontend before the Rust binary, because `rust-embed` packs the current `web/dist/` files into the executable. `web/dist/` is committed so that a fresh clone can build the binary without Node; rebuild and commit it whenever the frontend changes.

## Checks

```bash
scripts/check.sh          # locked installs, Rust and frontend checks, live contract, embedded release build
scripts/check.sh --full   # also bb host checks, Chromium, integrated (debug and release) browser checks, large benchmark
scripts/check.sh --full --skip-rust-checks   # as CI runs it: leaves out rustfmt, clippy and the Rust tests

# Optional focused checks:
scripts/check-contract.sh
rustup toolchain install 1.88.0 --profile minimal --component rustfmt --component clippy
RUSTUP_TOOLCHAIN=1.88.0 scripts/check.sh
```

The checks install npm dependencies with `scripts/npm-install.sh`, which runs `npm ci` in CI and `npm install` locally, so an unchanged folder is not reinstalled. They build the frontend with `scripts/build-web.sh`, which replaces only the `web/dist/` files whose contents changed, so an unchanged frontend does not make Cargo rebuild the release binary.

`.github/workflows/check.yml` runs the Rust checks on 1.88 and stable, and `scripts/check.sh --full --skip-rust-checks` on Node 24, on GitHub Actions. It also runs the Rust tests on macOS and Windows, and builds the Nix package on Linux and macOS. Every check also runs locally.

**Contract check.** `check-contract.sh` runs a test-only Rust exporter that uses the production parser, analyser and serialiser, then passes its 135 fresh outputs to the frontend's production `indexAnalysis` validator. The cases cover every tokenization policy, profile IDs, exposure and economics coverage, summaries at the end of a session, per-call timing and its sources, the largest safe numbers, and totals that exceed them. Controlled estimates go through the same production stages without needing huge test inputs, and invalid inputs must be rejected in Rust before they are exported. The temporary export folder is always removed, and the contract tests fail, rather than skip, when the exports are missing. They have their own Vitest config, so the normal frontend tests never depend on generated files.

**Formatting.** Prettier is configured in `web/.prettierrc.json` for Svelte and TypeScript source, tests and the root TypeScript configs, leaving out the generated `web/dist/`. Run `npm --prefix web run format` to apply it and `npm --prefix web run format:check` to check it.

**Browser tests.** The browser tests use Playwright with Chromium and mocked API responses. Install the browser once with `npm --prefix web run test:browser:install`. Tests run in parallel, including tests in the same file, so each test must set up its own page and data. A file whose tests change a shared fixture, such as the integrated OpenCode and Claude Code tests, sets `test.describe.configure({ mode: 'default' })` to run them one at a time. A run that takes longer than five minutes in total fails. To save desktop and narrow screenshots outside the repository, set `HIGHWATER_BASELINE_SCREENSHOTS=/tmp/highwater-browser-baseline` when running `npm --prefix web run test:browser`.

The integrated browser checks run the real server with its embedded frontend. Each uses the debug binary by default, or the release binary when `HIGHWATER_BROWSER_BUILD_PROFILE=release` is set:

- `scripts/browser-smoke-integrated.sh` uses a generated synthetic Pi session, and also checks its cache track and Composition at a pinned call.
- `scripts/browser-smoke-opencode-integrated.sh` generates a separate SQLite database and Pi session, and checks mixed discovery, filtering, OpenCode coverage and cost labels, view links, Composition, refresh after a WAL write, and the narrow layout.
- `scripts/browser-smoke-claude-code-integrated.sh` copies `fixtures/claude-code/projects` to a temporary folder, and checks the Claude Code filter, subagent labels, the coverage notice, API-equivalent cost, the River, Composition, a `304`, the own-total row, a live append and the narrow layout.
- `scripts/browser-smoke-vscode-copilot-integrated.sh` copies `fixtures/vscode-copilot/User` to a temporary folder, builds its trace database from `fixtures/vscode-copilot/traces.sql`, and checks the VS Code Copilot catalogue and filter, calls with and without trace records (timing, recorded cost, coverage note), a Claude call's cache policy and a `304`.

## Colour schemes

`web/src/lib/theme/palettes.ts` is the single source for named palette metadata, interface tokens, item-type colours and the ten individual-item colours. Add a complete entry to `palettes` to add a scheme; its ID must match its registry key. Set `colorScheme` to the native browser appearance it should use. System always resolves to the registered Dark or Light palette. The top-right picker labels this preference Auto. It shows a three-way Light / Dark / Auto toggle for the two built-in palettes and automatically uses a dropdown when more palettes are registered.

Keep token names semantic and define every token in every palette. Preserve item-kind meanings and individual-item slot ordering. `IndexedAnalysis.itemColorSlotById` stores stable assignments independently of the displayed palette; rendering helpers resolve slots using the active palette. Theme changes must not re-index analysis or recompute geometry.

The Vite plugin in `web/scripts/theme-html.ts` generates the palette CSS and adds a blocking classic script to the document head. It serves `theme-bootstrap.js` in development and emits `web/dist/theme-bootstrap.js` for production. The script is same-origin because the embedded server's Content Security Policy prohibits inline scripts. Both development and production HTML use it. Do not duplicate colours in component CSS or hand-edit the generated HTML. Black and white inside the River's luminance mask encode visibility and deliberately remain fixed; the standalone favicon is fixed artwork too.

The controller stores only the preference in `highwater.theme.v1`, separate from presentation preferences and shared links. Startup and system appearance changes do not write storage. The bootstrap and runtime controller share preference validation and are checked for equivalent resolution.

Run the generic palette/contrast tests and `npm --prefix web run test:browser -- theme.spec.ts` when adding a scheme. The browser tests capture desktop and narrow screenshots under `.playwright/test-results/` and test startup before the application module loads. Review neighbouring chart colours and translucent marks visually as well as checking text contrast. The Dark palette slightly brightens muted text, control borders and the non-read cache pattern compared with the original dark-only interface to meet the contrast checks. Ratio-change glyph labels now use contrasting text rather than always white.

Rebuild `web/dist/` before building Rust, and run the embedded browser checks as described above. The integrated Pi smoke test checks palette changes and persistence as well as chart navigation.

## Embeddable session view

`npm --prefix web run build:embed` builds `web/src/embed.ts` into the self-contained ES module `integrations/bb/vendor/highwater-embed.js`. The module and its hand-written declaration file are tracked, so consumers do not need Svelte build tools. It is separate from the Rust server's embedded frontend in `web/dist/`.

`mountHighwater({ target, loadAnalysis, preferencesKey, theme })` attaches a shadow root and returns `refresh()`, `setTheme()` and `destroy()`. `loadAnalysis(signal, etag)` supplies an analysis or a not-modified result; it should honour cancellation. The module validates and indexes the payload. The caller starts refreshes; the view does not poll. Call `destroy()` when removing the view. A destroyed target can be mounted again, including after a React development-mode effect cleanup.

Display preferences use the supplied storage key. Theme changes update only the palette store and the target element, not the host page, system setting or `highwater.theme.v1`. Multiple views in one module follow the same palette. The standalone page remains responsible for its own theme-controller lifecycle and URL updates. Catalogue references used in standalone view links remain separate from native IDs in analysis payloads.

`scripts/check-embed.sh` rebuilds the module and checks that its bytes match the tracked version. The normal check runs it without bb dependencies or build tools. Rebuild and include the vendor module whenever the shared view changes. `web/src/embed.test.ts` and `web/tests/browser/embed.spec.ts` exercise the built module, including focus, narrow layouts, palettes, two views and live replacements. The browser fixture in `web/tests/embed.html` is a test consumer, not another standalone entry point.

## bb host package

`integrations/bb/` is an independent package with its own lockfile and development dependencies. It contains the embeddable vendor module, host entry and server entry. The server resolves thread identities, serves analyses and summaries, and publishes update signals; the app entry adds a Context action tab. The app also registers a Context card row and a narrow-pane segment, using the same scheduler and the summary RPC. See [its development guide](../integrations/bb/README.md) for the implemented behaviour and limits.

`scripts/check-bb-plugin.sh` installs the frontend dependencies, checks the vendor module, builds debug and release Highwater binaries, installs the plugin's dependencies, checks formatting and types, runs unit, server contract, UI slot, scheduler and real-binary host/server round-trip tests, then builds the plugin with its pinned bb toolchain. Tests create only disposable fixtures under the repository's ignored `target/` directory. The ordinary repository check does not require bb tooling; `--full` runs this additional script, skipping the frontend install and vendor module check that `check.sh` has already done. A separate CI job exercises it on Linux and macOS.

For a focused iteration after dependencies and binaries exist, run `npm --prefix integrations/bb run check`, `npm --prefix integrations/bb test` and `npm --prefix integrations/bb run build`. `bb plugin types integrations/bb --check` checks the SDK pin against a running bb installation. The plugin has no CLI command, agent tool or injected skill. `npm --prefix integrations/bb run test:release` is an explicit network acceptance suite: it downloads and verifies all pinned platform archives, then starts the native binary with an empty PATH and reuses it offline. Ordinary tests and full checks do not require release downloads.

## Releases

`.github/workflows/release.yml` builds release archives for macOS, Linux and Windows. Pushing a tag such as `v0.1.0` checks that the tag matches `Cargo.toml` and the plugin package version, and that the binary pin is valid and not newer than the plugin, builds and packages each binary with the README, licence and changelog, and creates a draft GitHub release with the archives and a `SHA256SUMS` file. Write the release notes and publish it by hand. Running the workflow by hand from the Actions tab builds the archives without creating a release.

The crate and plugin versions are bumped together. A Highwater release is followed by a plugin release of the same version:

1. Run `python3 integrations/bb/scripts/check-bb-release.py`, `scripts/check.sh --full`, the release acceptance suite and a production-only dependency build, then tag `vX.Y.Z` and publish the release as above. At this tag the plugin still pins the previous release.
2. Run `python3 integrations/bb/scripts/pin-bb-binary-release.py X.Y.Z`; review the release provenance, archive digests, executable hashes and licence. The script replaces the previous pin.
3. Commit only `integrations/bb/host/binary-release.json`, and tag that commit `bb-plugin-vX.Y.Z`. The `bb-plugin-release` job in `check.yml` checks that the tag matches the plugin version, that the pin is the same version, and that the commit differs from `vX.Y.Z` only in the pin file, so the plugin's UI and binary come from the same source.

Runtime code never fetches checksums to establish trust. The existing release executables are not Developer ID signed or notarised; the plugin does not change OS security settings. Its MIT licence is retained beside the cached executable, with npm dependency notices in `integrations/bb/THIRD_PARTY_NOTICES.md`.

The remote Git install must be checked after the plugin tag is published, using a clean bb and `bb plugin install 'git:https://github.com/nickcox/highwater.git@^0.5' --tag-prefix bb-plugin- --plugin highwater`. Local builds cannot establish that unpublished installation path. Do not tag, push, publish a release or submit a marketplace entry without the maintainer's approval.

Publishing a release runs `.github/workflows/homebrew.yml`, which asks the [Homebrew tap](https://github.com/nickcox/homebrew-highwater) to open a pull request updating its formula. It needs a `HOMEBREW_TAP_DISPATCH_TOKEN` secret, a fine-grained personal access token with read and write access to the tap's contents; without it, the workflow only logs a warning.

## Price data

The price data for cost estimates is generated, not edited by hand; [data/prices/README.md](../data/prices/README.md) explains how to update it. `scripts/check.sh` runs the generator's tests with `python3 -m unittest discover -s scripts/tests`.

## Benchmarks

Build the release binary first.

- `scripts/benchmark-context-river.sh large` generates a large Pi session, reports median cold and warm request times, response size and peak memory, then removes the session.
- `python3 scripts/benchmark-opencode.py --full` creates synthetic SQLite data only, and checks conditional requests, uncached responses larger than the cache, checkpoints, concurrent reads and 200 WAL commits, then removes the database.
- `python3 scripts/benchmark-claude-code.py` generates a synthetic transcript as large as the largest seen locally, reports cold, cached and conditional request times and peak sampled server memory, then removes it.

To try OpenCode support against a real database, run `node scripts/accept-opencode-readonly.mjs /path/to/opencode.db`. It opens the database through the read-only server and checks one representative session, without taking screenshots or traces, printing transcripts, or writing to the database.
