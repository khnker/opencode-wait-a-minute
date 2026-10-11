# Tasks: Enforce Outcome-Based Done

## Evaluator Fixes
- [x] Refine `evaluateOutcome` to require `status: 'VERIFIED'` for observations/criteria satisfaction.
- [x] Separate mandatory and optional criteria evaluation; outcome status depends only on mandatory.
- [x] Add `timestamp` ordering to evidence resolution.
- [x] Refine `validateOutcomeContract` to require stable IDs and boolean `mandatory`.

## Integration
- [x] Import outcome evaluator into the completion gate.
- [x] Make `canComplete` call evaluateOutcome and block unless `ACHIEVED`.
- [x] Handle tasks without outcome contracts as `UNVERIFIED` (blocked).
- [x] Add blockers with outcome-specific reasons.
- [x] Unify completion gate delegation in `index.js` to `src/integration/orchestration.js`.
- [x] Protect `switchTo(..., "DONE", ...)` and `complete(taskId, root)` via `canComplete` gate.

## Tests
- [x] Update unit tests for optional criteria, temporal evidence, contradictory evidence.
- [x] Add integration tests for completion gate + outcome gate.
- [x] Add E2E lifecycle test.
- [x] Extend benchmark scenarios.

## Acceptance
- [x] `npm test` passes.
- [x] Integration tests prove completion gate blocks `DONE` when outcome not verified.
- [x] Existing tests and invariants remain valid.