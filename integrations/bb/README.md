# Highwater bb plugin

**In development.** The Context tab works for Pi and Claude Code threads. It uses the shared Highwater session view and updates from bb thread events. A Context row in the thread card, or a segment above the composer in narrow panes, shows a small summary and opens the tab.

The plugin runs a private Highwater server on the agent's machine, reads its catalogue and analyses through the existing HTTP API, and prepares compressed transfers and small summaries for bb. It does not read or modify session files itself.

## Try the Context tab

Once the plugin is installed and enabled, open a Pi or Claude Code thread, show its right panel, select **+** (New tab), then **Context**. You can also find Context in the panel's file/action search. The tab shows the session summary, River, Composition, inspector and lifespans. Pin a call to stop Follow latest; select **Follow latest** to resume.

The view follows bb's light or dark theme. It only requests analyses while visible. Hiding the tab pauses requests without losing pins or selections; reopening it checks for changes. Editing a message or clearing context resolves the session again, so an old session is not kept on screen. Errors explain what happened and provide Retry.

Refreshes start no more than once every two seconds, and no sooner than five times the previous fetch/JSON cycle duration. Signals received during a request are retained. Idle queues a final refresh after at least one second, subject to the same rate limit. Large sessions can therefore update more slowly. New session files get at most three automatic retries.

Analyses contain session content and travel through bb. The current development build requires Highwater on the agent machine's PATH or the binary override below. Automatic binary provisioning is still planned for the release package.

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

On macOS or Linux, `scripts/check-bb-plugin.sh` also checks the vendor module and runs all host and server checks. The complete repository check includes it with `--full`; the ordinary repository check does not install bb dependencies.

Tests use generated Pi sessions and copies of the Claude Code fixtures under this repository's ignored `target/` directory. They do not use existing conversations or session files. The process, SDK host and server round-trip tests exercise both debug and release binaries. UI tests mount the real embedded view through the SDK slot harness; scheduler tests use fake timers. Linux and macOS CI jobs run the same checks. Windows has not been validated.

## Server behaviour

For local development, install from the repository root with `bb plugin install path:./integrations/bb`. The **Highwater binary** setting defaults to an empty string, which uses `highwater` on PATH. Set an override with `bb plugin config highwater set binaryPath /absolute/path/to/highwater`; changes apply on the next request without a reload.

- `GET /api/v1/plugins/highwater/http/analysis?threadId=thr_…` accepts only a thread ID, never a session ID or path. It returns gzip JSON with an ETag, or a bodyless `304` for an unchanged analysis. Invalid input returns `400`; unavailable session states return `409`. Highwater errors keep their original status, code and message.
- The `threadSummary` RPC accepts `{ threadId, ifNoneMatch }` and returns a small summary with current bb context usage, including on an unchanged result. It never sends an analysis body to the caller.
- Each request resolves the thread's provider, latest identity and environment again. Resolution pages backward past unrelated operations. A completed context clear before the latest identity means no current session; the next prompt's identity restores resolution. Codex and other providers remain unsupported.
- The server joins at most 16 pieces and 64 MiB of compressed analysis, closes every opened transfer, and retries an expired transfer once. Cancellation stops that request, not other callers' shared host work. Plugin disposal aborts active requests.
- Coalesced thread events publish `thread-advanced` with `{ threadId, idle: false }`; idle and failure publish `idle: true`. No background service, schedule or stored thread mapping is used.
- HTTP and RPC use bb's local origin guard. This is not authentication: requests without an Origin are accepted by bb's local API. Remote access depends on the deployment's enclosing access controls and has not been validated. First-release support is local to the bb server's machine.

## Host behaviour

- No process starts when the module is loaded. The first request starts a server on an ephemeral loopback port.
- Development uses `highwater` on the host worker's PATH or an explicit `binaryPath`. The accepted binary range matches the plugin's minor version. Automatic binary download is deferred to the final packaging milestone; users of the released plugin will not need a separate install.
- Pi lookup uses `BB_PI_BRIDGE_SESSION_DIR` when present in the worker environment, otherwise `~/.bb/pi-bridge-sessions`. Claude Code uses `CLAUDE_CONFIG_DIR/projects`, otherwise `~/.claude/projects`. Existing Codex roots can be passed to Highwater, but Codex thread lookup is deliberately not enabled yet.
- bb may remove daemon-owned `BB_*` variables before starting a host worker. A custom Pi root is therefore honoured when it reaches that worker, but propagation from provider configuration is not yet verified. This must be resolved before claiming custom-root support in the finished plugin.
- An empty, private Pi directory suppresses Highwater's default sources when the real Pi directory does not exist. The process restarts when source directories appear or disappear, the binary path changes, or the child exits.
- Version probes have a five-second timeout and are hard-killed on timeout or worker disposal. Worker disposal stops the server with SIGTERM, followed by SIGKILL after two seconds if necessary. Repeated startup failures have a 60-second cooldown after the third failure.
- Analyses and summaries share in-flight loading per process generation and session. Each fetch revalidates its cached ETag. A cancelled caller stops waiting without cancelling shared work for other callers. At most two different analyses load concurrently.
- Compressed analyses are cached for two sessions. Cached and active-transfer buffers share a 64 MiB limit. Transfers are immutable, expire after 60 seconds and can be explicitly closed. Each raw piece is at most 4 MiB before base64, below bb's 8 MiB JSON result limit.
- Each HTTP fetch has a 20-second timeout. Analyses are limited to 128 MiB uncompressed and 64 MiB compressed. These bounds do not cap total process memory: parsing, compression and HTTP buffers require additional working memory.
- Analyses include session content. They travel through the bb server to the requesting client; summaries follow the same route. The plugin sends nothing to another service and does not persist analyses.

## Scope

The Rust server remains independent of bb. Its existing listening-line format is tested as an external startup contract. The TypeScript package depends only on public bb SDK surfaces and ordinary runtime dependencies. `skills: []` prevents adding agent instructions to every thread.
