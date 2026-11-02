# Fix per-session task binding

## Why

A delegated subagent creates its own WAM task and writes the global
`.wam/active-task` pointer with its own `sessionId`. The parent session's task
binding then disappears from disk: `readActiveTaskIdFresh()` rejects the
foreign record by ownership, `sessionTasks` is process-local, and
`maybeTaskLoop()` returns at `if (!taskId) return;`. Result: the parent task
never gets `execution/loop-state.json` and the autonomous loop silently stops.

## What Changes

- Persist a per-session task binding at `.wam/session-tasks/<sessionId>.json`
  whenever the active task is written with a `sessionId`.
- Resolve a session's task from its own binding before the global pointer.
- Recover existing sessions with no binding by scanning task directories for
  the `-sess-<last8>` suffix (and `ses-<sessionId>`) and choosing the most
  recently modified task.
- Keep the legacy global `.wam/active-task` and its 60s TTL for callers that do
  not pass a `sessionId`.

## Impact

- Affected specs: `task-session-binding` (new capability).
- Affected code: `src/shared/wam-paths.js`, `index.js`,
  `src/integration/message-handler.js` (no behavior change there; it already
  passes `sessionId`).
- No data migration: existing task directories are discovered by suffix.
- No change to loop decisions or quality contracts.
