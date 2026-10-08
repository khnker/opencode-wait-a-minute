# Change: Fix Governance Enforcement Deadlock
## Why
The tool-execution gate blocked every `write`/`edit` when a session had no tracked
task/contract (`getTaskState` returns `null`), deadlocking ad-hoc work and delegated
subagents. A real `@medium` subagent was blocked mid-task, flailed 22 bash calls and
burned ~590k tokens without applying any change.
## What Changes
- Centralize the contract gate in `enforceGovernance()` (single source of truth).
- Fail open when there is no tracked task/contract (nothing to approve).
- Exempt delegated subagents via robust parentID detection (fail-open on unresolved sessions).
- Add a trivial-change exemption (<= N declared files, no protected paths) and an audited override (`WAM_GOVERNANCE=off`).
- Add terminal-phase (COMPLETE/DONE) and ASKING exemptions; fix the corrupted directive string.
- Log every allow/deny decision via `src/integration/logger.js`.
## Non-goals
- Changing the Action Risk Envelope (`evaluateAction`) or the clarification gate.
- Removing the contract concept for tracked tasks.
## Expected Result
Ad-hoc and delegated sessions never deadlock; only the main session with a tracked,
non-approved contract is gated, and every decision is logged.
## Validation
- [x] `node --test tests/unit/governance-enforcement.test.mjs` passes
- [x] Full suite `node scripts/run-tests.mjs` passes
- [x] `node -e "import('./index.js')"` loads
## Program
- Bug: governance enforcement default-deny deadlock
- Priority: P0
