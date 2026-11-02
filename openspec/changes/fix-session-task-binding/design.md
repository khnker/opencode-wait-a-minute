# Design — per-session task binding

## Context

WAM keeps one active task pointer at `.wam/active-task` with
`{id, ts, sessionId, projectRoot}`. `message-handler` writes it for every
message that resolves a task (`src/integration/message-handler.js:283-285`).
OpenCode runs delegated subagents as separate sessions in the same project, so
the last writer wins. The pointer is global, but its ownership check is
per-session, which leaves the parent without a resolvable task.

The loop reads the task at `index.js:951` and `index.js:966` via
`sessionTasks.get(sessionID) || readActiveTaskIdFresh(...)`. The in-memory map
does not survive a process restart, and the disk pointer is owned by whichever
session wrote last.

## Goals

- A session always resolves its own task, even after another session writes the
  global pointer or after a restart.
- Existing task directories keep working without a migration.
- Callers without a `sessionId` keep the current global behavior.

## Non-Goals

- Changing how task ids are derived.
- Changing loop decisions, budgets, or quality contracts.
- Multi-process locking or cross-machine coordination.

## Decisions

### D1: Per-session sidecar plus legacy scan

Write `.wam/session-tasks/<sessionId>.json` on every active-task write that
carries a `sessionId`. `readActiveTaskIdFresh(root, {sessionId})` reads the
sidecar first. If it is absent, it scans `tasksDir` for a directory ending in
`-sess-<last8(sessionId)>` or equal to `ses-<sessionId>` and picks the newest
`task.json` by mtime.

Alternatives considered:

- **Per-session `active-task` path replacing the global file.** Rejected: it
  breaks `/wam task` CLI calls that have no session context and requires
  touching every reader/writer.
- **Forbid subagents from writing the global pointer.** Rejected: subagents
  still need a task for their own loop; suppressing the write would move the
  bug into the subagent.

### D2: Sidecar is advisory to the global pointer

The global pointer stays as the last-writer-wins record for session-less
callers. The sidecar is the session's source of truth and takes precedence only
when `sessionId` is supplied.

### D3: Bounded recovery scan

The scan reads at most the task directories already present under `.wam/tasks`
(the same bounded set pruned by retention). It filters by suffix before
statting, so cost is proportional to matching directories, not all tasks.

## Research

- OpenCode plugin hooks and session identity:
  https://opencode.ai/docs/plugins/
- Node.js filesystem API (`readdirSync`, `statSync`, `writeFileSync`):
  https://nodejs.org/api/fs.html
- Per-tenant/session state isolation (keying mutable pointers by owner):
  https://12factor.net/processes

## Risks

- Suffix collisions from `slice(-8)` could select a sibling session's task.
  Mitigated by preferring an exact `ses-<sessionId>` match and by the sidecar,
  which is written on the first message of every session.
- A stale sidecar could pin an old task after an explicit task switch.
  Mitigated by writing the sidecar from `writeActiveTaskId`, which the switch
  path calls.
