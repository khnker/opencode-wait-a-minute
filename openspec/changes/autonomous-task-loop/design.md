# Design: autonomous-task-loop

## Research

- OpenCode plugin API: events are delivered to `event({ event })`; `session.idle`
  carries `properties.sessionID`, and the plugin input exposes a `client` with
  `session.messages()` and `session.prompt()`.
  https://opencode.ai/docs/plugins/
- OpenCode server/session contract: `session.prompt` accepts
  `{ path: { id }, body: { parts: [...] } }`, which allows injecting a synthetic
  user turn into an existing session.
  https://opencode.ai/docs/server/
- Existing repo precedents reused here:
  - `openspec/changes/formal-execution-state` (strict transition table,
    `migrateLegacyPhase`).
  - `openspec/changes/automatic-completion-loop` (post-DONE continuation,
    synthetic prompt, per-session in-flight guard).
  - `openspec/changes/runaway-loop-budget-guard` (bounded execution).
  - `openspec/changes/verification-lifecycle` (evidence-driven completion).
- Node `fs` atomic-write pattern already used by `src/state/state-store.js`
  (write temp file, `rename`), and `task-store.js` sync persistence.

## Alternatives considered

### Controller placement

1. **New pure module `src/execution/task-loop.js` (chosen).** Keeps the decision
   table testable without OpenCode or I/O; matches `auto-continuation.js` style.
2. Extend `auto-continuation.js`. Rejected: that planner is specific to post-DONE
   validation and already has its own caps; growing it would mix two lifecycles.
3. Put the logic in `index.js`. Rejected: the monolith is already 2.6k lines and
   cannot be unit-tested without host mocks.

### Loop persistence

1. **Run-scoped `execution/loop-state.json` + `loop-events.jsonl` (chosen).**
   Matches the roadmap layout, keeps continuity separate from the requirement /
   evidence ledger, and supports replay.
2. Reuse `StateStore` sealed schemas. Rejected: it is async, generic and would
   require a new sealed schema; the loop needs a task-relative path and
   append-only event log.
3. Reuse `task.json`. Rejected: that is the authoritative task snapshot; adding
   run bookkeeping would couple lifecycle and loop state (the roadmap requires
   them independent).

### Adapter boundary

1. **`src/adapters/opencode-v1/` with injected client (chosen).** The controller
   never imports `@opencode-ai/plugin`, events or session clients; a future V2
   adapter can reuse the same controller.
2. Inline in `index.js`. Rejected: host coupling and no isolated tests.

## Design

### Controller input/output

```text
input  = { task, loop, progress, completionGate, authorization, budget }
output = { decision, reason, nextAction, checkpoint, stopReason }
```

Decision precedence (first match wins):

1. Task or loop already `COMPLETED` → `COMPLETE` (terminal, idempotent).
2. Loop `STOPPED` → replay its `stopReason` (no new work).
3. Authorization denied → `BLOCK`.
4. Pending authorization → `WAIT_AUTHORIZATION`.
5. `contractApproved === false` → `WAIT_USER`.
6. Task `BLOCKED` → `BLOCK`.
7. Budget exhausted or iteration limit reached → `STOP_BUDGET`.
8. Progress regressed or repeated rejected hypothesis → `REPLAN`.
9. Completion gate has no pending work → `COMPLETE`.
10. Gate requires verification → `VERIFY`.
11. No-progress streak reaches `maxNoProgress` → `STOP_STAGNATION`.
12. Otherwise → `CONTINUE`.

The controller only computes `checkpoint` deltas (`iteration`,
`consecutiveNoProgress`, `lastProgressFingerprint`); persistence applies them.

### Loop state

```json
{
  "schemaVersion": 1,
  "runId": "uuid",
  "taskId": "task-id",
  "sessionId": "session-id",
  "status": "RUNNING",
  "iteration": 4,
  "maxIterations": 10,
  "maxNoProgress": 3,
  "startedAt": 0,
  "updatedAt": 0,
  "lastTurnId": null,
  "lastProgressFingerprint": null,
  "consecutiveNoProgress": 0,
  "stopReason": null
}
```

- Snapshot writes are atomic (`loop-state.json.tmp` → `rename`).
- Events are append-only (`loop-events.jsonl`) with `seq`, `eventId`, `type`,
  `runId`, `at` and a payload.
- `appendLoopEvent` ignores an already-present `eventId` (idempotent).
- Corrupt snapshots are quarantined by name, never overwritten in place; state is
  rebuilt from events.
- A lock file (`loop.lock`, `wx` with stale detection) serializes writers.

### Adapter flow

```text
session.idle
  → normalize event (sessionId)
  → resolve taskId + project root
  → load loop state (or create run)
  → build authorization / gate / budget / progress snapshots
  → decideNextAction()
  → persist decision (snapshot + event)   <-- before any effect
  → CONTINUE / REPLAN / VERIFY → client.session.prompt(synthetic parts)
  → WAIT / BLOCK / COMPLETE / STOP → no prompt
```

The adapter keeps a per-session in-flight set, skips subagent sessions, and uses
an optional `turnId` to collapse duplicate `session.idle` events.

## Risks

- The controller is only as correct as the snapshots the adapter builds. The
  adapter derives gate, authorization and budget from existing modules instead of
  recomputing policy.
- Persisting before the prompt can leave a `CONTINUE` decision without a sent
  prompt if the process dies in between; recovery re-evaluates the decision, and
  the idempotent event log prevents duplicating the same action.
- Feature flag is enabled by default per product decision; deployments that need
  the previous behavior can opt out with `taskLoop.enabled=false` or
  `WAM_TASK_LOOP=0`. The flag stays independent of `autoLoop`.
- On each `session.idle` the adapter runs the existing post-DONE
  auto-continuation first; when it schedules a prompt, the task loop skips that
  idle so both drivers never prompt twice for the same turn.
