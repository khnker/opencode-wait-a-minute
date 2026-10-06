# Tasks

## Implementation
- [x] Continuation detection: `tests/unit/continuation-detection.test.mjs`.
- [x] Fast-path with valid context/evidence: `tests/unit/context-assembly.test.mjs` (continuation case sets `continuation: true` and skips rebuild).
- [x] Continuation invalidation on stale snapshots: `tests/unit/context-snapshot.test.mjs`.

## Validation
- [x] `node --test tests/unit/continuation-detection.test.mjs tests/unit/context-assembly.test.mjs tests/unit/context-snapshot.test.mjs` passes.
- [x] `openspec validate rc1-07-continuation-fast-path --strict` passes.
