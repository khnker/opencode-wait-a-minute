# Tasks: Enforce Outcome-Based Done

## Evaluator Fixes
- [ ] Refine `evaluateOutcome` to require `status: 'VERIFIED'` for observations/criteria satisfaction.
- [ ] Separate mandatory and optional criteria evaluation; outcome status depends only on mandatory.
- [ ] Add `timestamp` ordering to evidence resolution.
- [ ] Refine `validateOutcomeContract` to require stable IDs and boolean `mandatory`.

## Integration
- [ ] Import outcome evaluator into the completion gate.
- [ ] Make `canComplete` call evaluateOutcome and block unless `ACHIEVED`.
- [ ] Handle tasks without outcome contracts as `UNVERIFIED` (blocked).
- [ ] Add blockers with outcome-specific reasons.

## Tests
- [ ] Update unit tests for optional criteria, temporal evidence, contradictory evidence.
- [ ] Add integration tests for completion gate + outcome gate.
- [ ] Add E2E lifecycle test.
- [ ] Extend benchmark scenarios.

## Acceptance
- [ ] `npm test` passes.
- [ ] Integration tests prove completion gate blocks `DONE` when outcome not verified.
- [ ] Existing tests and invariants remain valid.