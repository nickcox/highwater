#!/usr/bin/env bash
# Measure deterministic generated sessions without exposing private session data.
set -euo pipefail

CASE=${1:-large}
ROOT=$(mktemp -d "${TMPDIR:-/tmp}/highwater-benchmark.XXXXXX")
PORT=${HIGHWATER_BENCHMARK_PORT:-$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')}
SERVER_LOG="$ROOT/server.log"
RESPONSE="$ROOT/analysis.json"
cleanup() {
  if [[ -n "${RSS_PID:-}" ]]; then kill "$RSS_PID" 2>/dev/null || true; wait "$RSS_PID" 2>/dev/null || true; fi
  if [[ -n "${SERVER_PID:-}" ]]; then kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; fi
  rm -rf "$ROOT"
}
trap cleanup EXIT

python3 scripts/generate-benchmark-session.py --case "$CASE" --output "$ROOT/benchmark.jsonl"
# Each cold instance needs a distinct native ID: duplicate portable references
# are intentionally ambiguous, even when their filenames differ.
python3 - "$ROOT" <<'PY'
import json, pathlib, shutil, sys
root = pathlib.Path(sys.argv[1])
for index in range(1, 6):
    with (root / 'benchmark.jsonl').open() as source, (root / f'benchmark-{index}.jsonl').open('w') as target:
        header = json.loads(source.readline())
        header['id'] += f'-{index}'
        target.write(json.dumps(header) + '\n')
        shutil.copyfileobj(source, target)
PY
cargo build --release >/dev/null
./target/release/highwater --session-root "$ROOT" --port "$PORT" --perf-diagnostics >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
RSS_FILE="$ROOT/peak-rss-kb"
printf '0\n' >"$RSS_FILE"
monitor_rss() {
  local peak=0 rss
  while kill -0 "$SERVER_PID" 2>/dev/null; do
    rss=$(ps -o rss= -p "$SERVER_PID" 2>/dev/null | tr -d '[:space:]')
    if [[ "$rss" =~ ^[0-9]+$ ]] && (( rss > peak )); then
      peak=$rss
      printf '%s\n' "$peak" >"$RSS_FILE"
    fi
    sleep 0.02
  done
  printf '%s\n' "$peak" >"$RSS_FILE"
}
monitor_rss &
RSS_PID=$!
for _ in $(seq 1 100); do
  if curl -fsS "http://127.0.0.1:$PORT/api/sessions" >/dev/null 2>&1; then break; fi
  sleep 0.05
done

session_url_id() {
  local file_name=$1
  curl -fsS "http://127.0.0.1:$PORT/api/sessions" | python3 -c 'import json, sys, urllib.parse; name=sys.argv[1]; sessions=json.load(sys.stdin)["sessions"]; match=next(item["id"] for item in sessions if item["fileName"] == name); print(urllib.parse.quote(match, safe=""))' "$file_name"
}

measure() {
  local session=$1
  local output=$2
  curl -fsS -o "$output" -w '%{time_total}\n' "http://127.0.0.1:$PORT/api/sessions/$session/analysis"
}

cold_times=()
for index in 1 2 3 4 5; do
  cold_times+=("$(measure "$(session_url_id "benchmark-$index.jsonl")" "$ROOT/cold-$index.json")")
done
warm_session=$(session_url_id "benchmark-1.jsonl")
warm_times=()
for index in 1 2 3 4 5; do
  warm_times+=("$(measure "$warm_session" "$ROOT/warm-$index.json")")
done
cp "$ROOT/cold-5.json" "$RESPONSE"
bytes=$(wc -c <"$RESPONSE" | tr -d ' ')
peak_rss_kb=$(cat "$RSS_FILE")
python3 - "$SERVER_LOG" "${cold_times[*]}" "${warm_times[*]}" "$CASE" "$bytes" "$peak_rss_kb" <<'PY'
import re, statistics, sys
log = open(sys.argv[1], encoding='utf-8').read()
cold = [float(value) for value in sys.argv[2].split()]
warm = [float(value) for value in sys.argv[3].split()]
perf = [line for line in log.splitlines() if line.startswith('analysis_perf ')]
print('\n'.join(perf[-6:]))
print('benchmark case=%s cold_median_seconds=%.6f warm_median_seconds=%.6f response_bytes=%s peak_rss_kb=%s' % (
    sys.argv[4], statistics.median(cold), statistics.median(warm), sys.argv[5], sys.argv[6]))
PY
