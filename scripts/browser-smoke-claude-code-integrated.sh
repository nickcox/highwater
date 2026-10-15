#!/usr/bin/env bash
# Synthetic Claude Code transcripts + Pi -> embedded Rust server -> real browser. No real logs.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP="$(mktemp -d "${TMPDIR:-/tmp}/highwater-claude-code-smoke.XXXXXX")"
PORT="${HIGHWATER_BROWSER_PORT:-$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')}"
PID=""
cleanup() {
  if [[ -n "$PID" ]]; then kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; fi
  rm -rf "$TEMP"
}
trap cleanup EXIT
TEMP="$(cd "$TEMP" && pwd -P)"
mkdir -p "$TEMP/pi"
python3 "$ROOT/scripts/generate-benchmark-session.py" --case small --output "$TEMP/pi/synthetic.jsonl"
cp -R "$ROOT/fixtures/claude-code/projects" "$TEMP/projects"
# check.sh builds the frontend once and sets HIGHWATER_FRONTEND_BUILT, so the checks it runs do not
# rebuild it; a rebuild rewrites web/dist, which makes Cargo rebuild the binary that embeds it.
if [[ "${HIGHWATER_FRONTEND_BUILT:-}" != 1 ]]; then
  npm --prefix "$ROOT/web" run build
fi
PROFILE="${HIGHWATER_BROWSER_BUILD_PROFILE:-debug}"
case "$PROFILE" in
  debug) cargo build --manifest-path "$ROOT/Cargo.toml" --quiet ;;
  release) cargo build --release --manifest-path "$ROOT/Cargo.toml" --quiet ;;
  *) printf 'Unsupported build profile\n' >&2; exit 2 ;;
esac
"$ROOT/target/$PROFILE/highwater" --session-root "$TEMP/pi" --claude-root "$TEMP/projects" --port "$PORT" --tokenization heuristic >"$TEMP/server.log" 2>&1 &
PID=$!
for _ in $(seq 1 100); do
  if curl --fail --silent "http://127.0.0.1:$PORT/api/sessions" >/dev/null; then break; fi
  if ! kill -0 "$PID" 2>/dev/null; then printf 'Synthetic server exited before readiness\n' >&2; exit 1; fi
  sleep 0.2
done
HIGHWATER_BROWSER_INTEGRATED=1 HIGHWATER_BROWSER_BASE_URL="http://127.0.0.1:$PORT" \
HIGHWATER_CLAUDE_CODE_FIXTURE="$TEMP/projects" \
  npm --prefix "$ROOT/web" run test:browser -- --grep 'integrated Claude Code'
