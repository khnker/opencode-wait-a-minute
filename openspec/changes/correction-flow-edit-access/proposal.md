# Proposal: Correction flows bypass the contract-approval gate

## Why

When `contractApproval` is `required`, WAM pauses every mutating tool until the
user runs `/wam contract approve` and injects "No ejecutes write/edit/apply_patch".
That ceremony is right for feature development but wrong for error correction:
fixing a reported error must proceed immediately. Not every flow is a
development flow.

## What changes

- Detect a correction flow from the intent lane (`CORRECTION`), the task kind
  (`debugging`) or correction markers in the objective/last action.
- Persist `flow: "correction"` on the task state for `CORRECTION`-lane messages.
- `enforceGovernance` returns `{ allowed: true, reason: "correction-flow" }` for
  correction flows, before the strict contract-approval check.
- The message handler skips the blocking `CONTRATO PENDIENTE` injection for
  `CORRECTION`-lane messages.
- `inferTaskKind` recognises Spanish correction markers (corrige, arregla,
  errores, falla).

## Out of scope

- Irreversible/destructive operations still block.
- Development/implementation flows keep the `contractApproval: "required"` gate.

## Research

- opencode plugin hooks: `tool.execute.before` is the blocking surface; returning
  `allowed: true` removes it. https://opencode.ai/docs/plugins/
- Predecessor change `zero-friction-advisory`: advisory surfaces, blocking only
  for irreversible/workspace-safety effects.
- Intent routing precedent: `src/policy/intent-router.js` already separates
  `CORRECTION` from `TASK_NEW`.
