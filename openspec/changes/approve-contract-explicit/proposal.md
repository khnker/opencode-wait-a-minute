# Approve contracts explicitly

## Why

WAM auto-approved contracts in two paths: `projectState` hardcoded
`contract.status: "APPROVED"` and `buildPersistedState` called
`applyBootstrapApproval` for the first task of a root without WAM memory.
As a result a user's direct order produced an `APPROVED` contract without any
explicit consent, contradicting the documented `/wam contract approve` flow and
making the persisted contract state lie about who approved it.

The default config is advisory: WAM must keep working without blocking writes
and without emitting an approval prompt. Advisory means "do not enforce", not
"silently approve".

## What Changes

- New contracts are always persisted with `contract.status: "PROPOSED"` and
  `nextAction: "Revisar contrato — /wam contract approve o edit"`.
- Remove the bootstrap auto-approval path (`applyBootstrapApproval`,
  `isBootstrapRoot`) and its import.
- Preserve an existing `APPROVED` contract on later messages (do not re-ask,
  do not reset).
- Keep `/wam contract approve` as the only transition to `APPROVED`.
- The advisory default still never blocks writes and never prompts; the
  approval prompt remains guarded by `contractApproval === "required"`.

## Impact

- `index.js`: `projectState`, `buildPersistedState`, import list.
- `src/context/context.js`: remove dead bootstrap helpers.
- Tests: `tests/unit/build-persisted-state-phase.test.mjs`,
  `tests/unit/root-identity-bootstrap.test.mjs`.
- Capability `wam-root-identity` delta: replaces the "first task born approved"
  requirement with explicit approval.
