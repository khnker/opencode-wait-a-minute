# Tasks

## Implementation
- [x] Completion gate rejects claim-without-evidence: `src/completion-gate.js` + `tests/unit/completion-gate.test.mjs`.
- [x] Completion gate rejects claim-without-required-action: `tests/unit/completion-gate.test.mjs`.
- [x] End-to-end adversarial coverage: `tests/unit/completion-gate-e2e.test.mjs`.
- [x] False-completion accounting: `src/false-completion-prevention.js` + `tests/unit/verification-tests.test.mjs`.
- [x] Result is `NOT VERIFIED` (not completion) when evidence/action is missing.

## Validation
- [x] `node --test tests/unit/completion-gate.test.mjs tests/unit/completion-gate-e2e.test.mjs` passes.
- [x] `openspec validate rc1-04-completion-gate-adversarial --strict` passes.
