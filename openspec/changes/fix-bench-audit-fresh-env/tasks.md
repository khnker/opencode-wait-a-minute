# Tasks
## Implementation
- [x] `latestResultsDir` selects only validation-format `raw.json` dirs (add `isValidationRaw`).
- [x] Add `resolveCommit(provenance)` and use it in `buildAudit` (fallback `"unknown"`).
## Tests
- [x] Add `latestResultsDir` regression tests (skip trace-replay, null when none).
- [x] Add `resolveCommit` tests.
## Validation
- [x] `node --test benchmarks/validation/audit-results.test.mjs` passes.
- [x] `node scripts/run-tests.mjs` passes.
- [x] `bench:audit` returns `ok:true` in a fresh non-git copy after a trace-replay run.
