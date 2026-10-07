# Verification

## Claim

WAM ties task progression and completion to verifiable evidence.

## Verification model

```text
implementation
      ↓
verification
      ↓
evidence
      ↓
verified state
      ↓
completion / next action
```

## Required behavior

Unsupported completion is blocked. Supported completion requires the evidence
defined by the active verification policy.

## Implementation

- requirement evaluation and verification — `src/verification/verification.js`
  (`evaluateRequirement`, `verifyRequirement`);
- outstanding-work check — `src/verification/verification-lifecycle.js`
  (`hasOutstandingWork`), which reports unverified requirements or pending
  backlog;
- completion gate — `transition()` in `src/execution/execution-state.js` throws
  when `to === "COMPLETED"` while `hasOutstandingWork(taskState)` is true
  (fail-closed).

## Tests

- `tests/unit/completion-gate.test.mjs`
- `tests/unit/completion-gate-e2e.test.mjs`
- `tests/unit/false-completion-prevention.test.mjs`
- `tests/unit/verification-lifecycle.test.mjs`
- `tests/unit/verification-completion.test.mjs`
- `tests/unit/verification-persistence.test.mjs`

**Status: Implemented, Tested.**

WAM verifies the conditions implemented by its verification mechanisms; it does
not verify arbitrary real-world correctness.

## See also

- [Evidence-Driven State](../concepts/evidence-driven-state.md)
- [Task State](task-state.md)
