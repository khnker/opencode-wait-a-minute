# Task State

## Claim

WAM prevents lost work by tracking verified progress and blocking premature completion.

## What this means

Without WAM, an agent might:
- Lose context between turns
- Repeat work already done
- Mark a task as done without verifying completion

WAM maintains a task state that evolves only with verified evidence.

## How WAM does it

WAM uses a state machine:
- Unknown → Understanding → Asking → Implementing → Verifying → Done
Each transition requires specific evidence.
Completion control blocks the Done state until verification is complete.

## Evidence

- Implementation: `src/task/`
- Unit tests: `tests/unit/task/`
- E2E scenarios: `tests/e2e/task-lifecycle/`

## Limitations

WAM's task state is specific to the OpenCode agent lifecycle. External workflows may not be tracked.

## Related documentation

- [Less Guessing](less-guessing.md)
- [Verification](verification.md)
