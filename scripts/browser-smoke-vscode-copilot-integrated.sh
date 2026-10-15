#!/usr/bin/env bash
# Synthetic VS Code Copilot sessions and trace records + Pi -> embedded Rust server -> real browser.
# No real logs.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP="$(mktemp -d "${TMPDIR:-/tmp}/highwater-vscode-copilot-smoke.XXXXXX")"
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
cp -R "$ROOT/fixtures/vscode-copilot/User" "$TEMP/User"
mkdir -p "$TEMP/User/globalStorage/github.copilot-chat"
python3 - "$ROOT/fixtures/vscode-copilot/traces.sql" "$TEMP/User/globalStorage/github.copilot-chat/agent-traces.db" <<'PY'
import pathlib, sqlite3, sys
script, database = sys.argv[1:]
c = sqlite3.connect(database)
c.executescript(pathlib.Path(script).read_text())
c.execute('PRAGMA journal_mode=WAL')
c.close()
PY
npm --prefix "$ROOT/web" run build
PROFILE="${HIGHWATER_BROWSER_BUILD_PROFILE:-debug}"
case "$PROFILE" in
  debug) cargo build --manifest-path "$ROOT/Cargo.toml" --quiet ;;
  release) cargo build --release --manifest-path "$ROOT/Cargo.toml" --quiet ;;
  *) printf 'Unsupported build profile\n' >&2; exit 2 ;;
esac
"$ROOT/target/$PROFILE/highwater" --session-root "$TEMP/pi" --vscode-user-dir "$TEMP/User" --port "$PORT" --tokenization heuristic >"$TEMP/server.log" 2>&1 &
PID=$!
for _ in $(seq 1 100); do
  if curl --fail --silent "http://127.0.0.1:$PORT/api/sessions" >/dev/null; then break; fi
  if ! kill -0 "$PID" 2>/dev/null; then printf 'Synthetic server exited before readiness\n' >&2; exit 1; fi
  sleep 0.2
done
HIGHWATER_BROWSER_INTEGRATED=1 HIGHWATER_BROWSER_BASE_URL="http://127.0.0.1:$PORT" \
HIGHWATER_VSCODE_COPILOT_FIXTURE="$TEMP/User" \
  npm --prefix "$ROOT/web" run test:browser -- --grep 'integrated VS Code Copilot'
