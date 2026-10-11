# Tasks

## Implementation
- [x] Assumption gate module: `src/assumption-tracking.js` (decision-critical classification).
- [x] Critical unknown blocks continuation: `tests/unit/assumption-gate.test.mjs`.
- [x] Non-critical unknown proceeds: `tests/unit/assumption-gate.test.mjs`, `tests/unit/assumption-tracking.test.mjs`.

## Validation
- [x] `node --test tests/unit/assumption-gate.test.mjs tests/unit/assumption-tracking.test.mjs` passes.
- [x] `openspec validate rc1-05-assumption-gate --strict` passes.
