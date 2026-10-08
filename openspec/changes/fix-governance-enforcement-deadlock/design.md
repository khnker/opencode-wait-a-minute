# Design: Fix Governance Enforcement Deadlock
## Approach
Reorder the gate: deny only on positively-confirmed risk instead of default-deny.
Keep `enforceGovernance` pure and pass a context (`isSubagent`, `declaredFiles`).
`index.js` supplies `isSubagent` from `sessionParents`/`sessionResolved` and delegates;
the inline duplicate is removed.
## Decisions
- Only `CONTRACT_GATED_TOOLS` (write/edit/apply_patch/patch/todo_write/todowrite) are gated;
  `bash`/`task` remain usable (investigation + delegation).
- No tracked state -> allow (fail-open): there is nothing to approve.
- Session ambiguity -> exempt (fail-open): a deadlock is worse than a missed block.
## Scope
- `src/policy/governance-enforcement.js` (rewrite), `index.js` (delegate + robust parent detection), tests.
## Validation Strategy
- Unit tests encode the full decision table; full suite guards no regressions.
## Risks
- Over-permissive gate: mitigated by logging every decision (auditable) and the protected-path list.
- Plugin reload: changes take effect only after opencode restart (plugins load once at startup).
