# Design: Correction flows bypass the contract-approval gate

## Goal

A task in an error-correction flow can edit immediately; development flows keep
the explicit `contractApproval: "required"` checkpoint.

## Alternatives

1. Config-only (`contractApproval: "advisory"`). Rejected: removes the gate for
   every flow, including feature development, and does not distinguish flows.
2. Remove the approval block globally. Rejected: contradicts the user's point
   that not all flows are development and discards the explicit strict opt-in.
3. Flow-aware bypass (chosen). Minimal, reuses the existing `CORRECTION` intent
   lane, and leaves development gating intact.

## Detection

`isCorrectionFlow(state)` is true when any of:
- `state.flow === "correction"` (persisted from the intent lane), or
- `state.kind` / `state.contract.kind === "debugging"`, or
- `state.lastAction`, `state.contract.objective` or `state.nextAction` matches a
  correction marker (`corrige`, `arregla`, `error(es)`, `falla(s)`, `fix`,
  `bug`, `debug`, `regression`, ...).

## Invariants

- Irreversible/destructive operations are still rejected by the execution guard.
- A non-correction flow with pending requirements and `requireApproval` still
  returns `{ allowed: false, reason: "contract-not-approved" }`.

## Research

- https://opencode.ai/docs/plugins/
- `openspec/changes/zero-friction-advisory/` (advisory policy precedent)
- `src/policy/intent-router.js` (`CORRECTION` lane)
