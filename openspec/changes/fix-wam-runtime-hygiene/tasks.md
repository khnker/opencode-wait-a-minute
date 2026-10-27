# Tasks: Fix runtime hygiene

- [x] Rotate `plugin.log` and `selection-log.jsonl` at 5 MB
- [x] Disable logging and redirect `WAM_LOG_FILE` for test runs
- [x] Make CQE telemetry best-effort and remove the unwritable store
- [x] Use word-boundary skill matching
- [x] Split contracts by sentence and preserve verbs
- [x] Make `nextActionFrom` idempotent
- [x] Cap `recent-changes.md` at 50 sections
- [x] Skip phase-based live task files in the runner aggregate
- [x] Add `scripts/prune-wam-artifacts.mjs` + test to archive one-use test tasks/snapshots
- [x] Add regression tests and validate the change
