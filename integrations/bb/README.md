# Highwater bb plugin

**In development.** The Context tab works for Pi, Claude Code and Codex threads. It uses the shared Highwater session view and updates from bb thread events. A Context row in the thread card, or a segment above the composer in narrow panes, shows a small summary and opens the tab.

The plugin runs a private Highwater server on the agent's machine, reads its catalogue and analyses through the existing HTTP API, and prepares compressed transfers and small summaries for bb. It does not read or modify session files itself.

## Try the Context tab

Once the plugin is installed and enabled, open a Pi, Claude Code or Codex thread, show its right panel, select **+** (New tab), then **Context**. You can also find Context in the panel's file/action search. The tab shows the session summary, River, Composition, inspector and lifespans. Pin a call to stop Follow latest; select **Follow latest** to resume.

The view follows bb's light or dark theme. It only requests analyses while visible. Hiding the tab pauses requests without losing pins or selections; reopening it checks for changes. Editing a message or clearing context resolves the session again, so an old session is not kept on screen. Errors explain what happened and provide Retry.

Refreshes start no more than once every two seconds, and no sooner than five times the previous fetch/JSON cycle duration. Signals received during a request are retained. Idle queues a final refresh after at least one second, subject to the same rate limit. Large sessions can therefore update more slowly. New session files get at most three automatic retries.

Analyses contain session content and travel through bb. No separate Highwater installation is required: the first request downloads a pinned release on the agent machine, verifies its archive and executable SHA-256 hashes against pins shipped with the plugin, and installs it privately. GitHub receives only binary download requests, not session content. Later starts recheck cached files and work offline. Download failures show a message and Retry; an explicit override can use a preinstalled binary.

The plugin source is not yet published. Develop with the path installation below. After publication, install with `bb plugin install git:https://github.com/nickcox/highwater.git --plugin highwater`. No marketplace submission is required for direct installation.

## Context row

The row shows model calls, compactions, a sparkline of reported input tokens, and bb's current context usage. The token ratio comes from bb, not from Highwater's last model call. Missing usage is labelled unavailable; missing reported points are not drawn as zero. Partial reconstruction is labelled partial.

Select **Context** to open its tab. The card row and narrow-pane segment share the same data, and the segment hides while bb shows the card. Unsupported agents and threads with no session show neither. Missing binaries and other failures show a short message that opens the tab for details.

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

Ordinary tests use generated Pi sessions and copies of the Claude Code and Codex fixtures under this repository's ignored `target/` directory. They do not use existing conversations or session files. The process, SDK host and server round-trip tests exercise both debug and release binaries. UI tests mount the real embedded view through the SDK slot harness; scheduler tests use fake timers. Linux and macOS CI jobs are configured to run the same checks; this worktree has not yet run in remote CI.

Provisioning tests use synthetic archives and stubbed HTTP responses, covering checksum and size failures, HTTPS redirects, unsafe paths, links, cancellation, atomic installation, cache corruption and compatible fallback. `npm --prefix integrations/bb run test:release` separately downloads all five real pinned archives, starts the native binary with no Highwater on PATH, and checks offline reuse. That acceptance suite requires internet access.

## Validation and limitations

Verified locally on macOS arm64 with bb 0.49.0 and Highwater 0.5.1. Live lookup and rendering cover Pi, Claude Code and Codex. Live edit/clear checks cover Pi and Claude Code; Codex forks are covered by fixtures.

Only one enrolled machine was available. Other agent machines, Linux, Windows and remote access have not been validated. Custom Pi root propagation from provider configuration remains unverified.

The largest locally linked bb session tested has 1,118 model calls, 3,099 items and two compactions: a 15 MB source file, 11.9 MiB analysis JSON and 1.08 MiB gzip transfer. A full HTTP transfer took 0.80 seconds; the chart was ready 1.87 seconds after opening the tab. Conditional requests had a median duration of 0.41 seconds and a median start interval of 2.08 seconds. Adding a headless-only 1.9-second client delay increased these to 2.40 and 12.02 seconds, consistent with the rate limit.

Observed browser JavaScript heap was about 40 MiB before opening and 235 MiB immediately after rendering. The highest later sample was 569 MiB, falling to 226 MiB after forced garbage collection. This is not total browser memory or a tested capacity limit. Larger analyses have not been browser-benchmarked.

## Server behaviour

For local development, install from the repository root with `bb plugin install path:./integrations/bb`. The **Highwater binary** setting defaults to an empty string, which provisions the pinned release. A non-empty value bypasses downloading, including a command such as `highwater` to deliberately use PATH. Set an override with `bb plugin config highwater set binaryPath /absolute/path/to/highwater`; changes apply on the next request without a reload.

- `GET /api/v1/plugins/highwater/http/analysis?threadId=thr_…` accepts only a thread ID, never a session ID or path. It returns gzip JSON with an ETag, or a bodyless `304` for an unchanged analysis. Invalid input returns `400`; unavailable session states return `409`. Highwater errors keep their original status, code and message.
- The `threadSummary` RPC accepts `{ threadId, ifNoneMatch }` and returns a small summary with current bb context usage, including on an unchanged result. It never sends an analysis body to the caller.
- Each request resolves the thread's provider, latest identity and environment again. Resolution pages backward past unrelated operations. A completed context clear before the latest identity means no current session; the next prompt's identity restores resolution. Providers other than Pi, Claude Code and Codex remain unsupported.
- The server joins at most 16 pieces and 64 MiB of compressed analysis, closes every opened transfer, and retries an expired transfer once. Cancellation stops that request, not other callers' shared host work. Plugin disposal aborts active requests.
- Coalesced thread events publish `thread-advanced` with `{ threadId, idle: false }`; idle and failure publish `idle: true`. No background service, schedule or stored thread mapping is used.
- HTTP and RPC use bb's local origin guard. This is not authentication: requests without an Origin are accepted by bb's local API. Remote access depends on the deployment's enclosing access controls and has not been validated. First-release support is local to the bb server's machine.

## Host behaviour

- No process starts when the module is loaded. The first request starts a server on an ephemeral loopback port.
- The accepted binary range matches the plugin's minor version. The preferred binary is pinned independently of the plugin patch version, currently Highwater 0.5.1. Downloads are available for macOS arm64/x64, Linux arm64/x64 (glibc 2.35 or newer), and Windows x64; availability is not a claim of verified execution on every platform. Unsupported platforms require an explicit compatible executable.
- Provisioning follows at most three HTTPS redirects, only through GitHub and its release asset hosts. Each archive is limited to its pinned size and 32 MiB, expansion to 128 MiB and 16 entries, and download/installation to 20 seconds, with bounded version-probe cleanup. Archive and executable hashes are pinned in `host/binary-release.json`; remote checksums are never trusted at runtime.
- Only expected regular files are read; links, special files, duplicate entries and path traversal are rejected. The executable and MIT licence are written into a private staging directory, synced and installed by same-filesystem directory rename. No system installer, elevation or PATH change is used. Existing OS security settings are not changed.
- Binaries live under the host's plugin data directory, in `binaries/VERSION/TARGET-SHA256/`. Cached executables and licences are rehashed before a new process starts; a running server is reused without hashing on each refresh. Concurrent requests in a worker share provisioning. Failed upgrades leave older caches intact; fallback is allowed only for compatible versions whose expected hashes remain in the plugin's pin history. Other old caches are not automatically executed or deleted.
- Pi lookup uses `BB_PI_BRIDGE_SESSION_DIR` when present in the worker environment, otherwise `~/.bb/pi-bridge-sessions`. Claude Code uses `CLAUDE_CONFIG_DIR/projects`, otherwise `~/.claude/projects`. Codex uses `CODEX_HOME`, otherwise `~/.codex`. Its UUID must match the complete UUID suffix in a `rollout-…-UUID.jsonl` or `.jsonl.zst` filename. Archived main sessions and forks are eligible; subagents are excluded.
- bb may remove daemon-owned `BB_*` variables before starting a host worker. A custom Pi root is therefore honoured when it reaches that worker, but propagation from provider configuration is not yet verified. This must be resolved before claiming custom-root support in the finished plugin.
- An empty, private Pi directory suppresses Highwater's default sources when the real Pi directory does not exist. The process restarts when source directories appear or disappear, the binary path changes, or the child exits.
- Version probes have a five-second timeout and are hard-killed on timeout or worker disposal. Worker disposal stops the server with SIGTERM, followed by SIGKILL after two seconds if necessary. Repeated startup failures have a 60-second cooldown after the third failure.
- Analyses and summaries share in-flight loading per process generation and session. Each fetch revalidates its cached ETag. A cancelled caller stops waiting without cancelling shared work for other callers. At most two different analyses load concurrently.
- Compressed analyses are cached for two sessions. Cached and active-transfer buffers share a 64 MiB limit. Transfers are immutable, expire after 60 seconds and can be explicitly closed. Each raw piece is at most 4 MiB before base64, below bb's 8 MiB JSON result limit.
- Each HTTP fetch has a 20-second timeout. Analyses are limited to 128 MiB uncompressed and 64 MiB compressed. These bounds do not cap total process memory: parsing, compression and HTTP buffers require additional working memory.
- Analyses include session content. They travel through the bb server to the requesting client; summaries follow the same route. The plugin sends nothing to another service and does not persist analyses.

## Scope

The Rust server remains independent of bb. Its existing listening-line format is tested as an external startup contract. The TypeScript package depends only on public bb SDK surfaces and ordinary runtime dependencies. `skills: []` prevents adding agent instructions to every thread.
