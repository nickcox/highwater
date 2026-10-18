# Codex fixtures

Synthetic Codex session files. They contain no real session content. The rules they test are in [docs/sources/codex.md](../../docs/sources/codex.md).

`home/` is laid out like `~/.codex`, so it can be used as a `--codex-home` in tests. The files are written by `scripts/generate-codex-fixtures.py`, because some are compressed and cannot be edited by hand. To change them, edit the script and run it again on an empty folder.

Thread IDs are UUID-shaped, with the fixture number in the last digits.

| Fixture | Thread ID ends | What it tests |
| --- | --- | --- |
| `sessions/2026/10/01/rollout-…-01` | `…001` | A main session with a title in `session_index.jsonl`, renamed by a later line. A U+2028 character inside a record. |
| `sessions/2026/10/01/rollout-…-02.jsonl.zst` | `…002` | A compressed main session with no title. |
| `sessions/2026/10/01/rollout-…-03` | `…003` | A guardian review of thread `…001` (`source.subagent.other` is `guardian`, with `forked_from_id`). |
| `sessions/2026/10/01/rollout-…-04` | `…004` | A spawned subagent of thread `…001`, with a nickname and an agent path. |
| `sessions/2026/10/01/rollout-…-05` | `…005` | A session with no reported usage, which is not listed. |
| `archived_sessions/rollout-…-06.jsonl.zst` | `…006` | An archived session, compressed as two zstd frames with a skippable frame between them. |
| `sessions/2026/10/01/rollout-…-07` | `…007` | A main session read in full: system prompt and an app tool, Codex's own developer and tagged user messages, an image, reasoning kept within a turn and dropped at the next, `exec_command` and `apply_patch` results, a compaction that keeps one message, adds another and has an encrypted summary, and the zero `token_count` after it. |
| `sessions/2026/10/01/rollout-…-08` | `…008` (thread `01a30000-…`) | A fork of `…007`: a copied parent turn (its turn ID sorts before the thread ID), its own turn, and an empty compaction followed by a history without a summary, read as one compaction. |
| `sessions/2026/10/01/too/deep/rollout-…-99` | `…099` | A session file deeper than the date folders, which discovery ignores. |
| `sessions/2026/10/01/notes.txt` | – | A file that is not a session. |
