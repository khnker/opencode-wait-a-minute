# Design: remove-approval-friction

## Research

- WAM already answers `permission.ask` with `allow`
  (`src/policy/permission-preflight.js`, `decidePermission`).
- `permissionEnforce` defaults to `false`, so `shouldBlockForPendingPermission` never
  blocks by default (`src/config/wam-config.js`).
- opencode permission dialogs are driven by the user's `opencode.json`, not by WAM
  (documented in `openspec/changes/reduce-readonly-permission-friction/design.md`).
- The contract is auto-approved under `contractApproval: "advisory"`
  (`applyBootstrapApproval` / `buildPersistedState`).

## Alternatives

1. **Stop injecting the notice at the call sites.** Rejected: leaves a stale `pending`
   plan in state, duplicates the policy across call sites, and `/wam status` still shows
   an unapproved plan.
2. **Default `permissionPreflight` to `false`.** Rejected: disables plan derivation
   entirely, losing the diagnostic summary in `/wam permissions`.
3. **Auto-grant the plan when derived (chosen).** A plan exists for diagnostics only;
   marking it `granted` makes `permissionPreflightLines` return `[]` and
   `delegationBlocked` return no recommendation, with one policy change at the source.
   Explicit `deny` is preserved and `contractApproval: "required"` still blocks via
   governance.

## Behavior

- `ensurePermissionPlan` returns a plan with `status: "granted"` and all required types
  in `granted`.
- An already-persisted `pending` plan is upgraded to `granted` on first read.
- `denied` plans are left untouched.
- The message handler no longer emits `Recomendación: contrato propuesto ...`.
- Blocking questions still set `ASKING` and stop the turn.

## Risks

- Downstream code inspecting `plan.status === "pending"` will no longer observe pending
  plans. The enforcement path (`shouldBlockForPendingPermission`) is covered by tests and
  remains correct: a denied/absent plan still behaves as before.
