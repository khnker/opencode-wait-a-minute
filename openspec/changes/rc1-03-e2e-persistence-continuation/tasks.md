# Tasks

## Implementation
- [x] Persistence/continuation covered by `tests/unit/completion-gate-e2e.test.mjs`, `tests/unit/context-assembly.test.mjs` (continuation case), and `tests/isolation/run.mjs`.
- [x] Runtime state persisted outside the repo under untracked `.wam/` (RC1-22): `docs/runtime-state.md`, `tests/runtime-state-isolation.test.mjs`.
- [x] No false completion on resume: `src/false-completion-prevention.js` + `tests/unit/verification-tests.test.mjs` (false-completion cases).
- [ ] Multi-session E2E asserting task-id recovery across a real crash/restart boundary.

## Validation
- [x] `npm test` passes including continuation + false-completion cases.
- [x] `npm run test:isolation` exits 0.
- [x] `openspec validate rc1-03-e2e-persistence-continuation --strict` passes.
