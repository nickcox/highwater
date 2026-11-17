#!/usr/bin/env bash
# Build the frontend into web/dist, replacing only files whose contents changed. A rebuild that
# rewrote unchanged files would make Cargo rebuild the release binary that embeds them.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$(mktemp -d "${TMPDIR:-/tmp}/highwater-web-build.XXXXXX")"
trap 'rm -rf "$OUT"' EXIT
npm --prefix "$ROOT/web" run build -- --outDir "$OUT" --emptyOutDir
rsync --recursive --checksum --delete "$OUT/" "$ROOT/web/dist/"
