# Tasks — close the task loop after an accepted agent run

## 1. Implementation

- [x] 1.1 `applyAgentRun` marks non-verified requirements `verified` with
      reviewer evidence when an `IMPLEMENT` run is `COMPLETED` / `ACCEPTED`.
- [x] 1.2 `decideNextAction` treats `completionGate.allDone === true` as
      complete and evaluates the no-progress guard before `verification-required`.
- [x] 1.3 `driveTaskLoop` persists the task as `DONE` when the decision is
      `COMPLETE`.

## 2. Tests

- [x] 2.1 Accepted `IMPLEMENT` run marks pending and done requirements
      `verified` and appends reviewer evidence; accepted `ANALYZE` runs do not.
- [x] 2.2 Non-accepted run leaves requirements unchanged.
- [x] 2.3 Pending work plus `requiresVerification` plus no-progress streak
      yields `STOP_STAGNATION`; a fresh verification still yields `VERIFY`.
- [x] 2.4 A `COMPLETE` decision persists the task as `DONE` with the completed
      next action.

## 3. Validation

- [x] 3.1 `node --test --test-force-exit <affected files>`
- [x] 3.2 `node scripts/run-tests.mjs`
- [x] 3.3 `npx openspec validate --changes --strict`
- [x] 3.4 `npm run build` and load `dist/index.js`
