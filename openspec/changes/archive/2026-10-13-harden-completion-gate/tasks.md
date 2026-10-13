## 1. OpenSpec Artifact Generation

- [x] 1.1 Run `openspec instructions --change harden-completion-gate proposal` → write to `openspec/changes/harden-completion-gate/proposal.md`
- [x] 1.2 Run `openspec instructions --change harden-completion-gate design` → write to `openspec/changes/harden-completion-gate/design.md`
- [x] 1.3 Run `openspec instructions --change harden-completion-gate specs` → write to `openspec/changes/harden-completion-gate/specs/spec.md`
- [x] 1.4 Run `openspec instructions --change harden-completion-gate tasks` → write to `openspec/changes/harden-completion-gate/tasks.md`

## 2. Code Changes Implementation

- [x] 2.1 Remove lexical bypass in `src/integration/orchestration.js` lines 104-106 (continuation regex early return)
- [x] 2.2 Remove lexical escape in `src/integration/message-handler.js` special-casing "aprobar contrato" for auto-approval (escape vulnerability)
- [x] 2.3 Update OpenSpec tasks.md to mark tasks as [x] for completed work

## 3. Verification

- [x] 3.1 Run `openspec validate --changes` and verify pass
- [x] 3.2 Run completion gate unit tests: `false-completion-prevention.test.mjs`
- [x] 3.3 Run completion gate E2E tests: `completion-gate-e2e.test.mjs`
- [x] 3.4 Run outcome completion gate seed tests: `outcome-completion-gate-seed.test.mjs`
- [x] 3.5 Run outcome evaluator tests: `outcome-evaluator.test.mjs`
- [x] 3.6 Run verification completion tests: `verification-completion.test.mjs`
- [x] 3.7 Run benchmark: `benchmarks/outcome-validation.mjs` (expect 3/3)

## 4. Post-Implementation

- [x] 4.1 Ensure all OpenSpec validations pass
- [x] 4.2 Commit changes with appropriate commit message
- [x] 4.3 Update status of change in OpenSpec system
