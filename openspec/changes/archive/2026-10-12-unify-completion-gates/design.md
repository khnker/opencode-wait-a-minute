# Design: Unify Completion Gates

## Decision
Make `evaluateCompletionGate` in `src/integration/orchestration.js` authoritative and delete the duplicate `canComplete` gate in `src/verification/completion-gate.js`.

## Rationale
The deleted twin was not reachable from production: its only importer, `src/state/task-lifecycle.js`, is imported only by tests. Keeping both gates duplicated the completion contract and allowed divergence.

## Changes
- `src/verification/completion-gate.js` — deleted.
- `src/state/task-lifecycle.js` — removed the `canComplete` import and DONE guard; it is now a low-level transition helper. The authoritative gate is applied at the integration layer.
- `src/verification/outcome-evaluator.js` — status comparison normalized to be case-insensitive (`verified`/`VERIFIED`).
- `src/integration/orchestration.js` — requirement evidence is bridged onto the single mandatory outcome criterion (prod seed declares one criterion).

## Base evidence checks
The live gate already covers blocks for blocking unknowns/assumptions, pending/unverified requirements, failing criteria, unapproved contract, failing requirement checks, and outcome attainment — so deleting the twin does not drop checks.

## Validation
`openspec validate --changes` plus the gate test suite (`tests/unit/verification-completion.test.mjs`, `tests/unit/outcome-completion-gate-seed.test.mjs`).
