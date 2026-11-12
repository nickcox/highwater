# Highwater bb plugin

**In development.** The embeddable view and host entry are implemented. There is no Context tab, row or thread resolver yet. Installing this package does not currently add a usable interface.

The plugin runs a private Highwater server on the agent's machine, reads its catalogue and analyses through the existing HTTP API, and prepares compressed transfers and small summaries for bb. It does not read or modify session files itself.

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

On macOS or Linux, `scripts/check-bb-plugin.sh` also checks the vendor module and runs all host checks. The complete repository check includes it with `--full`; the ordinary repository check does not install bb dependencies.

Tests use generated Pi sessions and copies of the Claude Code fixtures under this repository's ignored `target/` directory. They do not use existing conversations or session files. The process and SDK host tests exercise both debug and release binaries. Linux and macOS CI jobs run the same checks. Windows has not been validated.

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
- Session content stays in memory on the host at this stage. Later milestones send analyses through the bb server to the interface, so the finished plugin must not claim that session content never leaves the agent's machine.

## Scope

The Rust server remains independent of bb. The Rust change for this milestone preserves and tests the existing listening-line format as an external startup contract. The TypeScript package depends only on public bb SDK surfaces and ordinary runtime dependencies. `skills: []` prevents adding agent instructions to every thread.
