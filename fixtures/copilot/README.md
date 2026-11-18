# Copilot fixtures

Synthetic Copilot app and CLI sessions. They contain no real session content. The rules they test are in [docs/sources/copilot.md](../../docs/sources/copilot.md).

`home/` is laid out like `~/.copilot`, so it can be used as a `--copilot-home` in tests. The files are written by `scripts/generate-copilot-fixtures.py`. To change them, edit the script and run it again on an empty folder.

Session IDs are UUID-shaped, with the fixture number in the last digits.

| Session ID ends | What it tests |
| --- | --- |
| `…001` | A Copilot app session read in full: the system prompt, repeated unchanged before the second request; a `bash` call; a skill loaded with its context message; a failed `view` call; a response with reported reasoning; a subagent's call, which is left out; a change to a Claude model on the Messages API; and a compaction started in the background after call 3 and applied after the second request, with its own call (4) sent the context it started from, which keeps the last two of the eight messages it started from and the request added while it ran. A quoted title in `workspace.yaml`. |
| `…002` | A CLI session with no title, whose last line is unfinished. |
| `…003` | A session with no reported call, which is not listed. |
| `…004` | A session folder with no `events.jsonl`, which discovery skips. |
