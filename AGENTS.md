# Agent instructions

## Before merging into main

Run `scripts/check.sh --full` on the branch before merging it into `main`, and merge only if it passes. CI runs the same checks after the push, so a failure there means something reached `main` unchecked.

If a check fails, fix it on the branch. Do not skip a check or mark a test as skipped to get a passing run without saying so.

[docs/development.md](docs/development.md#checks) describes what the checks cover and how CI runs them.
