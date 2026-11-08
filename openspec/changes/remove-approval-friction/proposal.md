# Proposal: remove-approval-friction

## Problem

The user keeps seeing approval-flavoured notices during otherwise autonomous work:
`🔐 PERMISOS SUGERIDOS (informativo, no bloquea)` and a `Recomendación: ...` line
telling them to approve or edit something. None of it blocks execution, but it reads
as an approval request and interrupts the flow. The user's rule is explicit: if there
is no real question, keep executing.

## Analysis

`permission.ask` always answers `allow` (`decidePermission`), `permissionEnforce`
defaults to `false`, and delegation already never blocks. The only reason the advisory
still appears is that `ensurePermissionPlan` leaves newly derived plans in `pending`,
so `permissionPreflightLines` keeps producing the `PERMISOS SUGERIDOS` block and
`delegationBlocked` keeps producing a recommendation.

A second, quieter source is the contract-proposal recommendation emitted from the
message handler (`Recomendación: contrato propuesto ...`). Under the default
`contractApproval: "advisory"` the contract is already auto-approved, so the notice is
dead weight whenever it still fires.

## Decision

Auto-grant a permission plan the moment it is derived, and drop the contract-proposal
recommendation. Execution proceeds with no approval wording unless a genuine blocking
question parks the task in `ASKING`.

## Out of scope

- Genuine blocking questions (`ASKING`) still stop the turn; that is the one case where
  the user explicitly wants to be asked.
- `contractApproval: "required"` remains an opt-in strict gate.
- opencode's own permission dialogs are owned by opencode config, not WAM.
