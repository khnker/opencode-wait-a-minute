# Task State

## Claim

WAM maintains explicit task state so verified progress can persist across model
interactions.

## State

Task state represents the current lifecycle and verified knowledge required to
determine what happens next. It is created and normalized in
`src/state/task-state.js`, persisted under `.wam/tasks/<taskId>/` by
`src/state/task-store.js`, and written durably (atomic write + replay) by
`src/state/state-store.js`.

The authoritative lifecycle is the formal execution state machine in
`src/execution/execution-state.js` (see
[Task Lifecycle](../architecture/task-lifecycle.md)). Lifecycle transitions are
centralized in `src/state/state-machine.js`.

## Evidence

- task-state implementation — `src/state/task-state.js`;
- state machine — `src/state/state-machine.js`,
  `src/execution/execution-state.js`;
- persistence mechanism — `src/state/state-store.js`,
  `src/state/task-store.js`;
- lifecycle handling — `src/state/task-lifecycle.js`,
  `src/state/lifecycle-manager.js`.

## Required validation

At minimum:

1. state survives a subsequent interaction;
2. verified progress is recoverable;
3. invalid transitions are rejected;
4. completion requires the appropriate verification state.

## Tests

- `src/state/lifecycle-manager.test.mjs`
- `src/state/persistence-restart.test.mjs`
- `src/state/replay-engine.test.mjs`
- `tests/unit/state-machine.test.mjs`
- `tests/unit/verification-persistence.test.mjs`
- `tests/unit/task-runs.test.mjs`
- `tests/unit/wam-state.test.mjs`
- `tests/e2e/lifecycle/run.mjs`

**Status: Implemented, Tested.**

## See also

- [Verification](verification.md)
- [Task Isolation](task-isolation.md)
