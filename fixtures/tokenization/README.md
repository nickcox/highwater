# Tokenization fixtures

`claude-multipl-e.json` holds the 22 MultiPL-E programs from [ctok](https://github.com/sanderland/ctok) at commit `8c43ffd`, with the token counts Anthropic's `count_tokens` API returned for each one on three models: `claude-opus-4-5` (generation v3), `claude-opus-4-7` (v4.7) and `claude-opus-5` (v4.8). Each count covers one user message, so it includes the fixed per-message overhead listed under `overheads`. ctok is MIT licensed; its licence is in `LICENSE.ctok`.

The Rust test `claude_estimates_match_recorded_counts` uses this file to check that each of Highwater's Claude estimates equals the recorded count less the overhead. `scripts/check-claude-tokenizer-parity.py --ctok <checkout> --write-sample` regenerates it.
