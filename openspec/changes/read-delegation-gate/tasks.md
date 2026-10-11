# Tasks: Read Delegation Gate

- [x] 1. Compute `isSubagent` at function scope in `index.js` (before governance `try`).
- [x] 2. Add `DELEGATION_GATED_TOOLS` + `enforceReadDelegation` in `src/policy/governance-enforcement.js`.
- [x] 3. Wire the gate into `tool.execute.before` (main-session only).
- [x] 4. Support modes `off` | `warn` (default) | `enforce`; `enforce` throws `WamPolicyBlock`.
- [x] 5. Fail-open around evaluation/application.
- [x] 6. Tests: `tests/unit/read-delegation.test.mjs` (6) + `tests/unit/read-delegation-hook.test.mjs` (6) pass.
- [x] 7. Regression: `tests/unit/governance-enforcement.test.mjs` (16) still pass.
- [ ] 8. Commit (awaiting explicit approval).
