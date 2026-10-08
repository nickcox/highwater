#!/usr/bin/env bash
# Reproducible noninteractive checks, with optional browser/performance validation.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
case "${1:-}" in
  '') FULL=0 ;;
  --full) FULL=1 ;;
  *) printf 'Usage: scripts/check.sh [--full]\n' >&2; exit 2 ;;
esac
npm --prefix web ci
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --all-targets --locked
npm --prefix web run format:check
npm --prefix web run check
npm --prefix web run test
scripts/check-contract.sh
# rust-embed must see the current frontend before the final release build.
npm --prefix web run build
cargo build --release --locked
if [[ "$FULL" == 1 ]]; then
  npm --prefix web run test:browser:install -- --with-deps
  npm --prefix web run test:browser
  scripts/browser-smoke-integrated.sh
  TOKENPLUME_BROWSER_BUILD_PROFILE=release scripts/browser-smoke-integrated.sh
  scripts/browser-smoke-opencode-integrated.sh
  TOKENPLUME_BROWSER_BUILD_PROFILE=release scripts/browser-smoke-opencode-integrated.sh
  scripts/benchmark-context-river.sh large
  python3 scripts/benchmark-opencode.py --full
fi
