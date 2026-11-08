# Proposal: reduce-readonly-permission-friction

## Problem

The user reports seeing many permission prompts for read-only inspection commands
(`sed`, `rg`, `echo`) and finds it irritating ("es bastante incómodo").

## Analysis

Two independent layers can produce this experience:

1. **opencode bash approval dialogs** — owned by opencode's permission config, not
   by WAM. WAM's `permission.ask` hook always answers `allow`
   (`src/policy/permission-preflight.js`), so WAM cannot create an approval dialog.
2. **WAM's advisory notice** — the `PERMISOS SUGERIDOS (informativo, no bloquea)`
   block injected by `src/integration/message-handler.js`. The block has no approval
   action, but if it is re-injected every turn it reads like repeated permission
   noise.

## Change

- Make the WAM advisory truly **one-shot per task** by gating injection on
  `permissionPreflightNotified` (it was set but never used to suppress the notice).
- Add `shouldNotifyPermissionPlan` so the behavior is unit-testable.
- Record the recommended opencode allow-rules for read-only commands as a
  configuration artifact (layer 1), without WAM mutating user config.

## Non-goals

- WAM does not and must not gate `sed`/`rg`/`echo`; they are classified read-only
  (`src/policy/discovery-classifier.js`).
- No change to `permission.ask`; it stays `allow`.
