# Governance Enforcement
## ADDED Requirements
### Requirement: Contract gate never deadlocks untracked or delegated work
The governance gate MUST allow mutating tools when there is no tracked task/contract, when the caller is a delegated subagent, when the phase is terminal or ASKING, or when an explicit override is set, and MUST fail open when the caller's parentID cannot be resolved.
#### Scenario: Untracked session
- **WHEN** a `write` occurs with no task state
- **THEN** it is allowed and the decision is logged
#### Scenario: Delegated subagent
- **WHEN** a subagent (parentID present) calls `write`
- **THEN** it is allowed
#### Scenario: Tracked non-approved contract
- **WHEN** the main session calls `write` with a tracked, non-approved contract and a non-trivial change
- **THEN** a `WamPolicyBlock` is thrown with an actionable directive
#### Scenario: Trivial change
- **WHEN** the declared files are <= the trivial threshold and none is a protected path
- **THEN** the mutation is allowed
### Requirement: Governance decisions are observable
Every allow and deny decision MUST be written to the plugin log with tool, phase, contract status and reason.
#### Scenario: Denial logged
- **WHEN** a mutation is blocked
- **THEN** a `governance` log entry with `decision: "deny"` is written
### Requirement: Protected paths always require an approved contract
Protected paths MUST always require an approved contract regardless of file count: files under `.github/`, `migrations/`, `deploy/`, `.env*`, `ci.yml`/`ci.yaml`, `package.json`, `package-lock.json` and `tsconfig*.json` MUST NOT be treated as trivial.
#### Scenario: Protected path
- **WHEN** the declared files include `ci.yml`
- **THEN** the change is non-trivial and gated
