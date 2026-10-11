# Design: WAM Behavior Audit

## Approach

Standalone Node CLI (no new runtime dependencies) composed of isolated stages: `discover` -> `loadWam` -> `loadDb` -> `correlate` -> `analyze` -> `emit`. The database is opened read-only (`file:...?mode=ro&immutable=1`) and never written. All output goes to a dedicated audit root; source repositories and state are untouched. Analysis is deterministic and tolerant to missing or corrupted records (skipped and reported, never fatal).

### Correlation

1. Exact: WAM taskId suffix (after `ses-`) matches an OpenCode `session.id` suffix.
2. Project + time: same project path and nearest `session.time_updated`, corroborated by title/prompt similarity.
3. Unmatched: reported as orphan with reason.

Each match records `method`, `confidence`, and the evidence used.

### Axis A - direction

Compare the originating user objective (first user message part) against recorded `approvedStrategy`, contract plan and `nextAction`. Verdict: `ALIGNED | WEAK | DIVERGENT | NO_STRATEGY | UNKNOWN`, each citing the compared fields.

### Axis B - completion

Cross-check `phase`, `requirements[].status`, evidence artifacts (`summary.md`, `recent-changes.md`, evidence entries) and post-DONE session activity. Verdict: `COMPLETED | FALSE_SUCCESS | INCOMPLETE | ABANDONED | UNKNOWN`. `phase == DONE` contradicted by absent evidence or continued activity yields `FALSE_SUCCESS`.

### Axis C - retry

Count hypothesis failure->retry cycles, experiment outcomes and guard blocks; determine whether the terminal objective was reached after at least one failure. Verdict: `NO_RETRY_NEEDED | RETRIED_AND_SUCCEEDED | RETRIED_AND_FAILED | LOOPED_NO_PROGRESS | UNKNOWN`.

## Required scenarios

1. Exact match: taskId suffix maps to a session id.
2. Fallback match: no suffix match; resolved by project path + time + title similarity.
3. Orphan task: `.wam` task with no session; reported unmatched, analysis degrades to `UNKNOWN` not crash.
4. Orphan session: session with no `.wam` task; reported.
5. False success: `phase == DONE` but no evidence and/or continued activity -> `FALSE_SUCCESS`.
6. Retry success: at least one `FAILED` hypothesis followed by a completed objective -> `RETRIED_AND_SUCCEEDED`.
7. Read-only: DB and `.wam` bytes unchanged after a run (verified by mtime/hash).
8. Corrupt state: malformed `state.yaml` or DB row skipped and reported; run exits 0.
9. Determinism: two runs over identical inputs produce byte-identical JSON (stable ordering).
10. Offline: no network access required.
