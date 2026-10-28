# Execution Ledger

## Why

Task execution state (claims, actions, observations, evidence, verification) currently lives
in run-time structures and event logs that are either regenerated from a compaction brief or
replayed wholesale. Neither gives a durable, per-task, requirement-level truth that survives
compaction without trusting free text. Phase 4 requires an execution state that is updated
only from events and can be projected deterministically.

## What Changes

- Add `src/state/execution-ledger.js`: a per-task, event-sourced ledger persisted at
  `.wam/tasks/<taskId>/execution-ledger.json`.
- Add `applyEvents` (pure, idempotent), `projectExecution` (deterministic projection with
  obligations and conflicts), `loadExecutionLedger` / `saveExecutionLedger` (atomic write,
  fail loud on corrupt state).
- Reuse `VALID_TRANSITIONS` / `canTransition` from `src/verification/verification-model.js`
  instead of duplicating the requirement transition table.
- No changes to `context-compaction.js`, the compaction hook, `assembly.js`, `context.js`
  or the router. The ledger is additive in this phase.

## Impact

- Affected specs: `execution-ledger` (new capability).
- Affected code: new module and tests under `src/state/`. No call sites are changed in
  this phase, so existing behaviour is unchanged.
