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
npm --prefix web ci
if [[ "$RUST_CHECKS" == 1 ]]; then
  cargo fmt --check
  cargo clippy --all-targets --locked -- -D warnings
  cargo test --all-targets --locked
fi
python3 -m unittest discover -s scripts/tests
npm --prefix web run format:check
npm --prefix web run check
npm --prefix web run test
scripts/check-contract.sh
# rust-embed must see the current frontend before the final release build.
npm --prefix web run build
export HIGHWATER_FRONTEND_BUILT=1
cargo build --release --locked
if [[ "$FULL" == 1 ]]; then
  npm --prefix web run test:browser:install -- --with-deps
  npm --prefix web run test:browser
  scripts/browser-smoke-integrated.sh
  HIGHWATER_BROWSER_BUILD_PROFILE=release scripts/browser-smoke-integrated.sh
  scripts/browser-smoke-opencode-integrated.sh
  HIGHWATER_BROWSER_BUILD_PROFILE=release scripts/browser-smoke-opencode-integrated.sh
  scripts/browser-smoke-claude-code-integrated.sh
  HIGHWATER_BROWSER_BUILD_PROFILE=release scripts/browser-smoke-claude-code-integrated.sh
  scripts/browser-smoke-vscode-copilot-integrated.sh
  HIGHWATER_BROWSER_BUILD_PROFILE=release scripts/browser-smoke-vscode-copilot-integrated.sh
  scripts/benchmark-context-river.sh large
  python3 scripts/benchmark-opencode.py --full
fi
