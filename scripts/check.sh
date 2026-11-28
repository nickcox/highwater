#!/usr/bin/env bash
# Reproducible noninteractive checks, with optional browser/performance validation.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
FULL=0
RUST_CHECKS=1
for argument in "$@"; do
  case "$argument" in
    --full) FULL=1 ;;
    # For CI, whose rust job already runs rustfmt, clippy and the Rust tests.
    --skip-rust-checks) RUST_CHECKS=0 ;;
    *) printf 'Usage: scripts/check.sh [--full] [--skip-rust-checks]\n' >&2; exit 2 ;;
  esac
done
# Bash's time keyword reports elapsed time even when the command fails.
step() {
  local TIMEFORMAT="[check] %3lR  $*"
  time "$@"
}
step scripts/npm-install.sh web
step scripts/check-embed.sh
if [[ "$RUST_CHECKS" == 1 ]]; then
  step cargo fmt --check
  step cargo clippy --all-targets --locked -- -D warnings
  step cargo test --all-targets --locked
fi
step python3 -m unittest discover -s scripts/tests
step npm --prefix web run format:check
step npm --prefix web run check
step npm --prefix web run test
step scripts/check-contract.sh
# rust-embed must see the current frontend before the final release build.
step scripts/build-web.sh
export HIGHWATER_FRONTEND_BUILT=1
step cargo build --release --locked
if [[ "$FULL" == 1 ]]; then
  step env HIGHWATER_WEB_CHECKED=1 scripts/check-bb-plugin.sh
  step npm --prefix web run test:browser:install -- --with-deps
  step npm --prefix web run test:browser
  for profile in debug release; do
    step env HIGHWATER_BROWSER_BUILD_PROFILE="$profile" python3 scripts/browser-smoke.py all
  done
  step scripts/benchmark-context-river.sh large
  step python3 scripts/benchmark-opencode.py --full
fi
