# Highwater bb plugin

**Experimental.** The Context tab works for Pi, Claude Code and Codex threads. It uses the shared Highwater session view and updates from bb thread events. A Context row in the thread card, or a segment above the composer in narrow panes, shows a small summary and opens the tab.

The plugin runs a private Highwater server on the agent's machine, reads its catalogue and analyses through the existing HTTP API, and prepares compressed transfers and small summaries for bb. It does not read or modify session files itself.

## Try the Context tab

Once the plugin is installed and enabled, open a Pi, Claude Code or Codex thread, show its right panel, select **+** (New tab), then **Context**. You can also find Context in the panel's file/action search. The tab shows the session summary, a Latest call panel, River, Composition, inspector and lifespans. While Follow latest is on, each new call is pinned and summarised in the Latest call panel, and the River shows the most recent calls that fit at about 4 pixels per call. The tab starts with the Visible calls scale; if you choose Session scale, the tab remembers your choice. The tab uses the embed's compact density: smaller text, controls and gaps than the standalone viewer. Pinning another call or selecting the highlighted **Follow latest** button stops following; select it again to resume. While following, Clear selection clears only a selected item.

The view follows bb's light or dark theme. It only requests analyses while visible. Hiding the tab pauses requests without losing pins or selections; reopening it checks for changes. Editing a message or clearing context resolves the session again, so an old session is not kept on screen. Errors explain what happened and provide Retry.

Refreshes start no more than once every two seconds, and no sooner than five times the previous fetch/JSON cycle duration. Signals received during a request are retained. Idle queues a final refresh after at least one second, subject to the same rate limit. Large sessions can therefore update more slowly. New session files get at most three automatic retries.

Analyses contain session content and travel through bb. The plugin tries the first Highwater executable on the agent machine’s PATH if it reports the pinned version or newer. If there is no compatible executable or it fails to start, the plugin uses its privately cached release or downloads it and verifies its archive and executable SHA-256 hashes. GitHub receives only binary download requests, not session content. Later starts recheck cached files and work offline. Download failures show a message and Retry; an explicit override can use a preinstalled binary.

Install a plugin release from GitHub with `bb plugin install 'git:https://github.com/nickcox/highwater.git@^0.5' --tag-prefix bb-plugin- --plugin highwater`. Plugin releases are tagged `bb-plugin-vX.Y.Z`, and the range lets `bb plugin outdated` and `bb plugin update` find newer ones. Install from a plugin release tag rather than the default branch: between releases, the default branch has a newer UI than any published Highwater binary. No marketplace submission is required for direct installation. For local development, use the path installation below.

## Context summary

Above the composer, the summary shows a coloured bar beside bb's current context-window percentage. Each segment is sized by its share of estimated input tokens in the latest recorded model call and uses the matching Context River colour. Hover over the summary or focus it with the keyboard to see each item type’s percentage share and token count. When the latest call has no usable token estimates, the summary shows just the usage percentage.

In the wider thread card, the summary shows model calls, compactions when present, median input growth per call over the last ten calls since the latest compaction, and bb's current usage. A sparkline shows reported input across the session. The dashed line marks the context window, ticks mark compactions and the dot marks the latest point. When the window is unknown, the sparkline is scaled to the session's peak. Both layouts show when usage is unavailable and estimate how many calls remain when there is a positive recent growth rate.

Select the summary to open the Context tab. **Show context summary** is on by default. Turn it off in Highwater's plugin settings to hide the summary in both layouts. You can still open the Context tab from the panel menu. Unsupported agents and threads with no session have no summary. Missing binaries and other failures show a short message that opens the tab for details.

With the tab closed or hidden, only the small summary RPC response is sent to the browser. With both visible, one scheduler starts analysis and summary requests together; the host shares analysis work. Each response keeps its own ETag, and bb usage is refreshed even when the analysis is unchanged. Losing the last tab or row subscriber cancels only the request that is no longer needed.

## Development

Use Node 24 and a Rust toolchain. From the repository root:

```powershell
cargo build --locked
cargo build --release --locked
npm --prefix integrations/bb ci
npm --prefix integrations/bb run check
npm --prefix integrations/bb test
npm --prefix integrations/bb run build
```

Plugin maintenance scripts live in `integrations/bb/scripts/`. From the repository root, use `python3 integrations/bb/scripts/check-bb-release.py` to check release metadata, `python3 integrations/bb/scripts/pin-bb-binary-release.py VERSION` to review and pin a published binary release, and `python3 integrations/bb/scripts/generate-bb-notices.py` to regenerate dependency notices after installing both packages. These scripts resolve paths from their own location, not the working directory. Shared fixtures, Rust builds and embedded-view sources remain in the main repository.

On macOS or Linux, `scripts/check-bb-plugin.sh` also checks the vendor module and runs all host and server checks. The complete repository check includes it with `--full`; the ordinary repository check does not install bb dependencies.

Ordinary tests use generated Pi sessions and copies of the Claude Code and Codex fixtures under this repository's ignored `target/` directory. They do not use existing conversations or session files. The process, SDK host and server round-trip tests exercise both debug and release binaries. UI tests mount the real embedded view through the SDK slot harness; scheduler tests use fake timers. Linux and macOS CI jobs run the same automated plugin checks. Windows plugin execution has not been validated.

Provisioning tests use synthetic archives and stubbed HTTP responses, covering checksum and size failures, HTTPS redirects, unsafe paths, links, cancellation, atomic installation, cache corruption and the absence of a fallback to older releases. `npm --prefix integrations/bb run test:release` separately downloads all five real pinned archives, starts the native binary with no Highwater on PATH, and checks offline reuse. That acceptance suite requires internet access.

## Validation and limitations

Verified locally on macOS arm64 with bb 0.49.0 and Highwater 0.5.1. Live lookup and rendering cover Pi, Claude Code and Codex. Live edit/clear checks cover Pi and Claude Code; Codex forks are covered by fixtures.

Automated host/process checks have passed in Linux and macOS CI. Interactive validation remains limited to the local Mac: only one enrolled machine was available, and other-machine operation, Windows plugin execution and remote access have not been validated. Custom Pi root propagation from provider configuration remains unverified.

The largest locally linked bb session tested has 1,118 model calls, 3,099 items and two compactions: a 15 MB source file, 11.9 MiB analysis JSON and 1.08 MiB gzip transfer. A full HTTP transfer took 0.80 seconds; the chart was ready 1.87 seconds after opening the tab. Conditional requests had a median duration of 0.41 seconds and a median start interval of 2.08 seconds. Adding a headless-only 1.9-second client delay increased these to 2.40 and 12.02 seconds, consistent with the rate limit.

Observed browser JavaScript heap was about 40 MiB before opening and 235 MiB immediately after rendering. The highest later sample was 569 MiB, falling to 226 MiB after forced garbage collection. This is not total browser memory or a tested capacity limit. Larger analyses have not been browser-benchmarked.

## Server behaviour

For local development, install from the repository root with `bb plugin install path:./integrations/bb`. The **Highwater binary** setting defaults to an empty string, which checks PATH before using the pinned release. A non-empty value bypasses downloading, including a command such as `highwater` to deliberately use PATH. Set an override with `bb plugin config highwater set binaryPath /absolute/path/to/highwater`; changes apply on the next request without a reload.

- `GET /api/v1/plugins/highwater/http/analysis?threadId=thr_…` accepts only a thread ID, never a session ID or path. It returns gzip JSON with an ETag, or a bodyless `304` for an unchanged analysis. Invalid input returns `400`; unavailable session states return `409`. Highwater errors keep their original status, code and message.
- **Show more** fetches up to 8 KiB of text for the selected item on demand. The plugin looks up the current session from the thread again for each page. With an older Highwater binary, the tab uses the expanded preview included in the analysis.
- The `threadSummary` RPC accepts `{ threadId, ifNoneMatch }` and returns a small summary with current bb context usage, including on an unchanged result. It never sends an analysis body to the caller.
- Each request resolves the thread's provider, latest identity and environment again. Resolution pages backward past unrelated operations. A completed context clear before the latest identity means no current session; the next prompt's identity restores resolution. Providers other than Pi, Claude Code and Codex remain unsupported.
- The server joins at most 16 pieces and 64 MiB of compressed analysis, closes every opened transfer, and retries an expired transfer once. Cancellation stops that request, not other callers' shared host work. Plugin disposal aborts active requests.
- Coalesced thread events publish `thread-advanced` with `{ threadId, idle: false }`; idle and failure publish `idle: true`. No background service, schedule or stored thread mapping is used.
- HTTP and RPC use bb's local origin guard. This is not authentication: requests without an Origin are accepted by bb's local API. Remote access depends on the deployment's enclosing access controls and has not been validated. First-release support is local to the bb server's machine.

## Host behaviour

- No process starts when the module is loaded. The first request starts a server on an ephemeral loopback port.
- Each plugin release pins the Highwater release with the same version, because the plugin's embedded UI is built from the same source as that binary. The PATH executable must report the pinned version or newer. The managed release must match the pin exactly. An explicit binary can have any valid version. The Context tab shows a notice naming both versions when they differ. Downloads are available for macOS arm64/x64, Linux arm64/x64 (glibc 2.35 or newer), and Windows x64; availability is not a claim of verified execution on every platform. On other platforms, use a compatible executable on PATH or set an explicit override.
- Provisioning follows at most three HTTPS redirects, only through GitHub and its release asset hosts. Each archive is limited to its pinned size and 32 MiB, expansion to 128 MiB and 16 entries, and download/installation to 20 seconds, with bounded version-probe cleanup. Archive and executable hashes are pinned in `host/binary-release.json`; remote checksums are never trusted at runtime.
- Only expected regular files are read; links, special files, duplicate entries and path traversal are rejected. The executable and MIT licence are written into a private staging directory, synced and installed by same-filesystem directory rename. No system installer, elevation or PATH change is used. Existing OS security settings are not changed.
- Binaries live under the host's plugin data directory, in `binaries/VERSION/TARGET-SHA256/`. Cached executables and licences are rehashed before a new process starts; a running server is reused without hashing on each refresh. Concurrent requests in a worker share provisioning. A failed download shows an error and Retry; older cached releases are not used in its place. Old caches are not automatically deleted.
- Pi lookup uses `BB_PI_BRIDGE_SESSION_DIR` when present in the worker environment. Otherwise it looks in `plugins/provider-pi/bridge-data/sessions` under the bb machine's data directory, then in `~/.bb/pi-bridge-sessions`. If both directories exist, a second local Highwater process starts only when lookup needs the legacy directory. Claude Code uses `CLAUDE_CONFIG_DIR/projects` or `~/.claude/projects`. Codex uses `CODEX_HOME` or `~/.codex`. Its UUID must match the complete UUID suffix in a `rollout-…-UUID.jsonl` or `.jsonl.zst` filename. Archived main sessions and forks are eligible. Subagents are excluded.
- bb may remove daemon-owned `BB_*` variables before starting a host worker. A custom Pi root is therefore honoured when it reaches that worker, but propagation from provider configuration is not yet verified. This must be resolved before claiming custom-root support in the finished plugin.
- An empty, private Pi directory suppresses Highwater's default sources when the real Pi directory does not exist. The process restarts when source directories appear or disappear, the binary path changes, or the child exits.
- Version probes have a five-second timeout and are hard-killed on timeout or worker disposal. Worker disposal stops the server with SIGTERM, followed by SIGKILL after two seconds if necessary. Repeated startup failures have a 60-second cooldown after the third failure.
- Analyses and summaries share in-flight loading per process generation and session. Each fetch revalidates its cached ETag. A cancelled caller stops waiting without cancelling shared work for other callers. At most two different analyses load concurrently.
- Compressed analyses are cached for two sessions. Cached and active-transfer buffers share a 64 MiB limit. Transfers are immutable, expire after 60 seconds and can be explicitly closed. Each raw piece is at most 4 MiB before base64, below bb's 8 MiB JSON result limit.
- Each HTTP fetch has a 20-second timeout. Analyses are limited to 128 MiB uncompressed and 64 MiB compressed. These bounds do not cap total process memory: parsing, compression and HTTP buffers require additional working memory.
- Analyses include session content. They travel through the bb server to the requesting client; summaries follow the same route. The plugin sends nothing to another service and does not persist analyses.

## Scope

The Rust server uses no bb code or services. It only knows where bb's Pi provider stores sessions, so that `highwater serve` lists them by default. Its existing listening-line format is tested as an external startup contract. The TypeScript package depends only on public bb SDK surfaces and ordinary runtime dependencies. `skills: []` prevents adding agent instructions to every thread.
