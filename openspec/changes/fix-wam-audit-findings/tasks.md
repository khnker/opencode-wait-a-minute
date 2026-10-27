# Tasks: Fix Wait-a-Minute Plugin Audit Findings

- [x] Implement spec deltas for completion-gate-adversarial, durable-state, and wam-runtime-bypass (spec deltas under specs/)
- [x] F1: Fix verified-evidence bypass in orchestration.js and verification-policy.js
- [x] F2: Remove prompt text early-return in evaluateCompletionGate
- [x] F3: Implement atomic writes, fail-loud parsing, and error surfacing in task-state-file.js
- [x] F4: Add comprehensive tests for `/wam off` / `/wam on` session bypass at all three enforcement points
- [x] F5: Implement actual migration runner with version-ordered apply/up functions
- [x] F6: Gate contract approval prompt on non-trivial task analysis
- [x] Add integration tests for all six findings
- [x] Update documentation where needed (README runtime controls)
