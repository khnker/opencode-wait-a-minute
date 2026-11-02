# Change: autonomous-task-loop

## Why

WAM already has the pieces of autonomy (formal execution state, post-DONE
auto-continuation, loop budget guard, cognitive state, completion gate,
verification) but they are not connected by a persistent controller. When a
turn ends without the task being complete, continuity depends on the user
typing "continúa", and an OpenCode restart loses the execution cycle.

The previous roadmap split this into seven changes. This change implements the
first executable slice: a pure decision controller, run-scoped persistent loop
state, and a thin OpenCode V1 adapter, behind a feature flag that is disabled by
default.

## What Changes

1. Add a pure `src/execution/task-loop.js` controller. It receives task, loop,
   progress, completion gate, authorization and budget snapshots and returns a
   deterministic decision (`CONTINUE`, `REPLAN`, `VERIFY`, `WAIT_USER`,
   `WAIT_AUTHORIZATION`, `BLOCK`, `COMPLETE`, `STOP_BUDGET`,
   `STOP_STAGNATION`).
2. Add run-scoped loop persistence in
   `.wam/tasks/<taskId>/execution/loop-state.json` plus an append-only
   `loop-events.jsonl`, with atomic writes, schema versioning and replay.
3. Add a small OpenCode V1 adapter under `src/adapters/opencode-v1/` that
   normalizes `session.idle`, consults the controller, persists the decision
   before any external effect and sends the continuation prompt through
   `client.session.prompt`.
4. Add a `taskLoop` feature flag (default enabled, opt-out) independent of `autoLoop`.
5. Cover the controller, persistence and adapter with regression tests.

## Non-goals

- Reimplementing `formalize-execution-transitions`, `automatic-completion-loop`,
  `runaway-loop-budget-guard`, `execution-decoupling`,
  `autonomy-runtime-guards`, `add-task-completion-validation` or
  `execution-ledger`.
- A second requirement/evidence ledger: the existing `execution-ledger.json`
  remains the projection for requirements and evidence. Loop state records
  execution continuity only.
- Reviewer/architect/verifier agents, multi-agent debate, V2 migration.
- Auto-approving contracts, permissions or authorizations.
