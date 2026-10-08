#!/usr/bin/env bash
# Synthetic SQLite + Pi -> embedded Rust server -> real browser. No real logs.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP="$(mktemp -d "${TMPDIR:-/tmp}/tokenplume-opencode-smoke.XXXXXX")"
PORT="${TOKENPLUME_BROWSER_PORT:-$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')}"
PID=""
cleanup() {
  if [[ -n "$PID" ]]; then kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; fi
  rm -rf "$TEMP"
}
trap cleanup EXIT
TEMP="$(cd "$TEMP" && pwd -P)"
mkdir -p "$TEMP/pi" "$TEMP/store"
python3 "$ROOT/scripts/generate-benchmark-session.py" --case small --output "$TEMP/pi/synthetic.jsonl"
python3 - "$ROOT" "$TEMP/store/opencode.db" <<'PY'
import pathlib, sqlite3, sys
root, database = sys.argv[1:]
c = sqlite3.connect(database)
for name in ['legacy-schema.sql', 'simple.sql', 'modern-schema.sql', 'modern.sql']:
    c.executescript((pathlib.Path(root) / 'fixtures/opencode' / name).read_text())
c.execute('PRAGMA journal_mode=WAL')
c.close()
PY
npm --prefix "$ROOT/web" run build
PROFILE="${TOKENPLUME_BROWSER_BUILD_PROFILE:-debug}"
case "$PROFILE" in
  debug) cargo build --manifest-path "$ROOT/Cargo.toml" --quiet ;;
  release) cargo build --release --manifest-path "$ROOT/Cargo.toml" --quiet ;;
  *) printf 'Unsupported build profile\n' >&2; exit 2 ;;
esac
"$ROOT/target/$PROFILE/tokenplume" --session-root "$TEMP/pi" --opencode-db "$TEMP/store/opencode.db" --port "$PORT" --tokenization heuristic >"$TEMP/server.log" 2>&1 &
PID=$!
for _ in $(seq 1 100); do
  if curl --fail --silent "http://127.0.0.1:$PORT/api/sessions" >/dev/null; then break; fi
  if ! kill -0 "$PID" 2>/dev/null; then printf 'Synthetic server exited before readiness\n' >&2; exit 1; fi
  sleep 0.2
done
TOKENPLUME_BROWSER_INTEGRATED=1 TOKENPLUME_BROWSER_BASE_URL="http://127.0.0.1:$PORT" \
TOKENPLUME_OPENCODE_FIXTURE="$TEMP/store/opencode.db" \
  npm --prefix "$ROOT/web" run test:browser -- --grep 'integrated OpenCode'
