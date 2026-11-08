# Proposal: Add Craftsman Review to the Definition of Done

## Summary
Make the review of code changes against the `craftsman` skill's Diff Audit an
explicit part of "done", so completion cannot be claimed while KISS, DRY or
clean-code violations remain in the diff.

## Motivation
The verify skill guards completion with evidence, but it validates *behavior*,
not the *shape* of the change. A diff can pass every test and still add
unjustified abstractions, copy-paste duplication, coupling or dead code. The
`craftsman` skill already defines those rules (Diff Audit); this change wires
them into the completion gate.

## Scope
- `skills/verify/SKILL.md`: new V10 invariant, a "Craftsman review of the diff"
  procedure step, and a completion condition.
- `AGENTS.md`: workflow step 5b before validation.
- `tests/unit/verify-skill.test.mjs`: regression test that the review is part of
  the gate.

## Out of scope
- Runtime enforcement in `src/verification/completion-invariants.js` (see
  design.md for why).
