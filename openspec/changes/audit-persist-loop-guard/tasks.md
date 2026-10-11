## Tasks

## 1. Implementation
- [x] 1.1 Add an audit flush coalescer in `src/persistence/audit-coalescer.js` with a size and idle-time threshold.
- [x] 1.2 Add a directory-state gate checking `.wam/` existence/writability and file checksum before flush.
- [x] 1.3 Implement task-directory cap enforcement with oldest-first eviction.

## 2. Integration & Testing
- [x] 2.1 Update `ContextDecisionTracer` to route writes through the coalescer.
- [x] 2.2 Add `tests/unit/audit-loop-guard.test.mjs` covering: size flush, idle flush, missing-dir skip, unchanged-file skip, dir cap eviction.
- [x] 2.3 Run tests: `node --test tests/unit/audit-loop-guard.test.mjs`.
