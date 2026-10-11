# Design: Enforce Outcome-Based Done

## 1. Outcome contract improvements

- Use stable identifiers for criteria and evidence.
- Require explicit evidence type (e.g., `evidence`, `observation`, `test`, `measurement`).
- Distinguish mandatory (`mandatory: true`) vs optional (`mandatory: false`) criteria.
- Allow an optional `source` field for provenance (file, agent, LLM call, test suite).
- Add `temporalSequence` for evidence ordering when resolving contradictions.

## 2. Outcome evaluation fixes

- Observations require verification status (e.g., `status: 'VERIFIED'`) to count toward satisfied criteria.
- Track time-ordered evidence: newer valid evidence overrides older invalid ones unless explicitly invalidated.
- Contradictory evidence must be marked as `status: 'FAILED'` or `status: 'INVALID'` and should not satisfy any mandatory criterion.
- Separate mandatory criteria from optional: final outcome status depends only on mandatory criteria.
- Optional criteria can be tracked separately and reported as quality metrics, but their absence does not block completion.

## 3. Integration with completion gate

- The `canComplete(taskRoot, taskId)` gate MUST call `evaluateOutcome` (or an internal outcome evaluator) to get `outcomeStatus` and `canComplete`.
- If `outcomeStatus !== OUTCOME_STATUSES.ACHIEVED` or `canComplete === false`, the gate MUST return `allowed: false` with a blocker reason.
- The blocker reason should include both execution blockers (from requirement-state evidence) and outcome blockers (e.g., "outcome not ACHIEVED", "mandatory criterion unmet", "insufficient evidence").
- The integration should be backward compatible: existing tasks without outcome contracts should be considered `UNVERIFIED` (blocked for `DONE`).

## 4. Testing

- Unit tests for evaluator: optional criteria, temporal evidence, contradictory evidence, contract validation.
- Integration tests: completion gate blocks `DONE` when actions succeed but outcome is unverified.
- E2E tests: real WAM task lifecycle with outcome contracts.
- Benchmarks: extended synthetic dataset covering the edge cases.

## 5. Architectural considerations

- Reuse existing evidence lineage (`src/evidence/evidence-lineage.js`).
- Use the existing task state structure (`src/skills/engine.js`) for outcome contracts.
- Ensure the evaluator does not duplicate the logic of the requirement-state verifier.
- Store outcome evaluation results (e.g., in task state or as a sidecar file) for auditability.