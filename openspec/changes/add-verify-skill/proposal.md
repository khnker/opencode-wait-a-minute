# Change: Add the verify skill

## Why

WAM already has a completion gate, evidence lifecycle, and quality contracts, but
there is no dedicated skill that tells an agent how to verify a task before it
claims completion. The result is avoidable false DONE claims: the runtime can
detect them, yet the agent has no single procedure that maps each acceptance
criterion to an observable check and evidence.

## What Changes

- Add `skills/verify/SKILL.md`, an on-demand verification skill triggered by
  verification/completion language.
- Define the runtime invariants that must hold before any completion claim.
- Add a runtime invariant checker used by the existing completion gate so the
  skill's rules are not only prose.
- Add regression tests for skill discovery, routing, and each invariant.

## Non-goals

- Do not flip `completionGate.enforce` to hard blocking by default. The existing
  opt-in configuration remains the source of enforcement.
- Do not replace the existing completion gate or the verification lifecycle.
- Do not require a new tool or network dependency.

## Expected Result

An agent that follows the verify skill produces traceable evidence and does not
claim DONE while the gate has pending requirements. Structured evidence is
checked for session isolation, freshness, contradictions, and strength before the
gate can return `allDone`.

## Validation

- [ ] `verify` is discoverable and routable.
- [ ] The skill documents every runtime invariant it relies on.
- [ ] Optional requirements do not block completion.
- [ ] Cross-session, stale, contradictory, and insufficient evidence block.
- [ ] Malformed state and pending backlog block.
- [ ] Existing advisory behavior remains unchanged.
