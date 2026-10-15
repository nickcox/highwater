#!/usr/bin/env bash
# Fresh production Rust outputs -> production TypeScript validator. No stale goldens.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/highwater-contract.XXXXXX")"
cleanup() { rm -rf "$CONTRACT_DIR"; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Resolve even a relative TMPDIR before changing the working directory; keep the
# original cleanup path intact if canonicalization itself fails.
ABSOLUTE_CONTRACT_DIR="$(cd "$CONTRACT_DIR" && pwd -P)"
CONTRACT_DIR="$ABSOLUTE_CONTRACT_DIR"
cd "$ROOT"
export HIGHWATER_CONTRACT_DIR="$CONTRACT_DIR"
cargo test --locked analysis::contract::export_live_contract -- --exact
npm --prefix "$ROOT/web" run test:contract
