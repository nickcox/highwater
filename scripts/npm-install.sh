#!/usr/bin/env bash
# Install a folder's npm dependencies: `npm ci` in CI, so an out-of-date lockfile fails, and
# `npm install` locally, which returns at once when node_modules already matches the lockfile.
set -euo pipefail
if [[ -n "${CI:-}" ]]; then
  npm --prefix "$1" ci
else
  npm --prefix "$1" install --no-audit --no-fund
fi
