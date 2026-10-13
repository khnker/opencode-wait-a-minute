# Tasks: Unify Completion Gates

## 1. Remove dead twin
- [x] 1.1 Delete `src/verification/completion-gate.js`.
- [x] 1.2 Remove the orphan `canComplete` import and usages from `src/state/task-lifecycle.js`.
- [x] 1.3 Remove the dead-twin load entry from `scripts/performance-sanity.mjs`.
- [x] 1.4 Delete the dead-twin unit test `tests/unit/completion-gate.test.mjs`.

## 2. Harden surviving gate
- [x] 2.1 Normalize status casing in `src/verification/outcome-evaluator.js`.
- [x] 2.2 Bridge requirement verification evidence onto the single mandatory outcome criterion.

## 3. Tests
- [x] 3.1 Verify single-gate behavior via `tests/unit/verification-completion.test.mjs`.
- [x] 3.2 Verify seeding + block behavior via `tests/unit/outcome-completion-gate-seed.test.mjs`.
