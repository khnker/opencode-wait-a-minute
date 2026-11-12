# Design: explicit contract approval

## Research

- OpenCode plugin hooks and tool gating: https://opencode.ai/docs/plugins/
- OpenSpec change/spec conventions: https://github.com/Fission-AI/OpenSpec
- RFC 2119 (`MUST`/`SHOULD`) for requirement wording:
  https://www.rfc-editor.org/rfc/rfc2119
- Principle of least astonishment (a persisted "approved" state must match what
  the user did): https://en.wikipedia.org/wiki/Principle_of_least_astonishment
- Twelve-Factor config (advisory vs enforcing is configuration, never a silent
  state mutation): https://12factor.net/config

## Decision

A fresh contract is always written as `PROPOSED`, regardless of config or
whether the root already has WAM memory. Advisory config changes only whether
the governance gate *enforces* approval; it never writes `APPROVED`.

The delta under `wam-root-identity` supersedes the "first task of a fresh root
is born approved" requirement introduced by the still-unarchived
`wam-root-identity-bootstrap` change; that change is intentionally left
unarchived.

`buildPersistedState` preserves an existing contract (including `APPROVED`) and
normalizes `phase: "PROPOSED" → "IMPLEMENTING"` when the contract is `APPROVED`
**or** when the config is advisory (`requireApproval !== true`). Required config
still parks the workflow in `PROPOSED` until approval. This keeps advisory
"without blocking" while the contract status still records the truth.
`approveContract` remains the only writer of `status: "APPROVED"`.

## Alternatives considered

1. **Keep bootstrap approval behind a config flag.**
   Rejected: still a hidden state mutation, adds config surface, and the
   reported bug is precisely that a user order approves a contract.
2. **Auto-approve only the first task of a fresh root.**
   Rejected: this is the root cause. A fresh root is the common case for new
   users, so it maximizes surprise and breaks the documented explicit flow.
3. **Always PROPOSED and rely on advisory mode (chosen).**
   Smallest diff, no new config, no blocking in the default config, and the
   persisted state matches the user's actions.

## Risks

- Existing sessions whose task state was bootstrapped keep `APPROVED`; this is
  intentional (reuse, do not re-ask).
- Removing `isBootstrapRoot`/`applyBootstrapApproval` is a breaking change for
  any external importer. No runtime or test importer remains.
- A fresh contract without requirements still returns early without persisting
  (unchanged), so there is nothing to approve.
