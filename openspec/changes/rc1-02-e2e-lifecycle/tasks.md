# Tasks

## Implementation
- [x] Stage-level integration covered across suites: `tests/unit/execution-concurrency-e2e.test.mjs`, `tests/unit/completion-gate-e2e.test.mjs`, `tests/e2e/opencode/smoke.mjs`, `tests/e2e/migration/run.mjs`, `tests/isolation/run.mjs`.
- [ ] Single unified prompt→done lifecycle test asserting every stage emits its signal (prompt → classification → context → routing → execution → completion).

## Validation
- [x] `npm test` passes (2569 tests / 0 fail) exercising the individual stages.
- [x] `npm run gate` reports Test Suite + E2E stages PASS.
- [x] `openspec validate rc1-02-e2e-lifecycle --strict` passes.
