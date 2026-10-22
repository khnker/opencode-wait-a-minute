## 1. Core Implementation
- [x] 1.1 Create `graph-builder.js` module.
- [x] 1.2 Implement `buildContextGraph(taskState, runState, evidenceState)` function.
- [x] 1.3 Map task dependencies and constraints to `ContextGraph`.
- [x] 1.4 Map run decisions, actions, and observations.
- [x] 1.5 Map evidence lineage and verification results.

## 2. Refactoring
- [x] 2.1 Refactor `router-adapter.js` to consume `ContextGraph` from `graph-builder.js`.
- [x] 2.2 Remove inline graph construction logic from `router-adapter.js`.

## 3. Verification
- [x] 3.1 Create `graph-builder.test.mjs` with deterministic reconstruction tests.
- [x] 3.2 Add graph equivalence tests verifying semantic mapping.
- [x] 3.3 Ensure existing Router tests pass with the new graph builder.
