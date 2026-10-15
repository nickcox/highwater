#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/highwater-browser-smoke.XXXXXX")"
PORT="${HIGHWATER_BROWSER_PORT:-$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')}"
BUILD_PROFILE="${HIGHWATER_BROWSER_BUILD_PROFILE:-debug}"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

python3 "$ROOT/scripts/generate-benchmark-session.py" \
  --case small \
  --output "$TMP_ROOT/browser-smoke.jsonl"

npm --prefix "$ROOT/web" run build
case "$BUILD_PROFILE" in
  debug)
    cargo build --manifest-path "$ROOT/Cargo.toml" --quiet
    BINARY="$ROOT/target/debug/highwater"
    ;;
  release)
    cargo build --release --manifest-path "$ROOT/Cargo.toml" --quiet
    BINARY="$ROOT/target/release/highwater"
    ;;
  *)
    printf 'Unsupported HIGHWATER_BROWSER_BUILD_PROFILE: %s (expected debug or release)\n' "$BUILD_PROFILE" >&2
    exit 2
    ;;
esac
"$BINARY" \
  --session-root "$TMP_ROOT" \
  --port "$PORT" \
  --tokenization heuristic >"$TMP_ROOT/server.log" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 100); do
  if curl --fail --silent "http://127.0.0.1:$PORT/api/sessions" >/dev/null; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    printf '%s\n' 'Highwater server exited before becoming ready:' >&2
    cat "$TMP_ROOT/server.log" >&2
    exit 1
  fi
  sleep 0.2
done

if ! curl --fail --silent "http://127.0.0.1:$PORT/" | grep -q 'Highwater'; then
  printf '%s\n' 'Highwater embedded frontend did not become ready:' >&2
  cat "$TMP_ROOT/server.log" >&2
  exit 1
fi

HIGHWATER_BROWSER_INTEGRATED=1 \
HIGHWATER_BROWSER_BASE_URL="http://127.0.0.1:$PORT" \
  npm --prefix "$ROOT/web" run test:browser -- --grep 'integrated Rust-served'
