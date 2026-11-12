# Proposal: remove-write-and-ask-gates

## Why

WAM still interrupts autonomous work even though its approval flow is advisory:

- `tool.execute.before` rejects every write/edit/bash whose path resolves outside the
  task root (`tool-path-guard`).
- The execution gate aborts mutating tools while the analysis/agent pass runs, so the
  main model cannot use its normal `write`/`edit`/`bash` tools.
- `shouldBlockForPendingPermission` can throw when `permissionEnforce` is enabled.
- The action-risk envelope throws when `WAM_STRICT_BLOCK=1`.
- `enforceGovernance` still hard-blocks when `contractApproval: "required"`.
- An inferred uncertainty (for example "the prompt contains *elimina*") becomes a
  `blocking` unknown, parks the task in `ASKING`, and the message handler answers the
  turn with "No implementar hasta responder".

The user's rule is explicit: remove any write-tool restriction and any approval that
prevents advancing; only a genuine technical ambiguity may stop the turn.

## What Changes

1. Remove the WAM workflow write gates from `tool.execute.before`: path guard,
   permission-preflight throw, execution-gate abort, strict-risk throw, and the
   contract-approval hard block. WAM must rely on opencode's own tool/permission layer
   and use the normal tools.
2. Inferred uncertainties are recorded as `advisory`; they never park the task in
   `ASKING`. Only an unknown explicitly marked `blocking: true` (a real technical
   ambiguity) may do so.
3. Keep safety invariants that are not workflow approvals: irreversible/destructive
   operations (hard delete, U1 soft-archive) and corrupt-state validation stay blocked.

## Out of scope

- Removing opencode's own permission dialogs (owned by opencode config).
- Removing evidence or completion reporting (their blocking effect is already gone).
- Deleting historical tasks or `.wam` state.
