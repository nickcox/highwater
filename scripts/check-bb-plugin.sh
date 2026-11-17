#!/usr/bin/env bash
# Check the plugin UI, scheduler and host/server contracts against both real binaries.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# check.sh has already installed web/ and checked the embed when it sets HIGHWATER_WEB_CHECKED.
if [[ "${HIGHWATER_WEB_CHECKED:-}" != 1 ]]; then
  npm --prefix web ci
  scripts/check-embed.sh
fi
cargo build --locked
cargo build --release --locked
npm --prefix integrations/bb ci
npm --prefix integrations/bb run format:check
npm --prefix integrations/bb run check
npm --prefix integrations/bb test
npm --prefix integrations/bb run build
