# Frontend UX Integration

## ADDED Requirements

### Requirement: Three explicit capability states

The system MUST expose exactly three frontend UX capability states: `unavailable`, `available-but-disabled`, and `enabled`. State resolution MUST be read-only and MUST NOT install packages, download assets, or mutate user configuration.

#### Scenario: Disabled leaves behavior unchanged
- **WHEN** the capability is `available-but-disabled`
- **THEN** WAM behavior is identical to a build without the integration and no UX delegation occurs

#### Scenario: Unavailable reports explicit status
- **WHEN** Impeccable is not detectable and the capability resolves to `unavailable`
- **THEN** WAM continues its standard lifecycle and reports the explicit `unavailable` status without claiming an audit occurred

#### Scenario: Enabled permits delegation
- **WHEN** the user opts in and the capability resolves to `enabled`
- **THEN** compatible frontend UX tasks may delegate specialized UX work to Impeccable

### Requirement: Upstream provenance recording

The system MUST record static upstream provenance for Impeccable including license, revision, supported agents, install mechanism, command definitions, and dependencies. Detection and delegation MUST NOT require network access at task time.

#### Scenario: Provenance available for inspection
- **WHEN** provenance is queried
- **THEN** the recorded license, revision, install mechanism, command definitions, and dependencies are returned from static metadata

### Requirement: Opt-in delegation scoped to compatible tasks

When the capability is `enabled` and a task is a compatible frontend UX task, the system MUST delegate the specialized UX step. Backend-only tasks MUST NOT activate the capability.

#### Scenario: Frontend task delegates
- **WHEN** the capability is `enabled` and the task touches frontend presentation or interaction
- **THEN** the specialized UX work is delegated to Impeccable

#### Scenario: Backend-only task does not activate
- **WHEN** the capability is `enabled` and the task is backend-only
- **THEN** no frontend UX delegation occurs and the standard lifecycle proceeds

### Requirement: Explicit fallback without fabricated success

When Impeccable is unavailable, or the requested command/agent is unsupported, the system MUST fall back gracefully with an explicit status and MUST NOT report the work as audited or completed.

#### Scenario: Unsupported command or agent falls back
- **WHEN** delegation is requested for an unsupported command or agent
- **THEN** an explicit `unsupported` fallback status is returned and no success is fabricated

### Requirement: Completion contract boundary

Integration logic MUST NOT alter `DONE` semantics or participate in the completion gate. Completion MUST remain governed exclusively by the existing WAM outcome contract.

#### Scenario: Existing outcome and lifecycle tests stay green
- **WHEN** the integration is enabled
- **THEN** existing outcome and lifecycle tests continue to pass unchanged

### Requirement: User configuration preservation

The system MUST NEVER overwrite or mutate the user's Impeccable configuration. Any install or configuration change is user-initiated.

#### Scenario: User config unchanged
- **WHEN** capability detection and delegation run
- **THEN** the user's Impeccable configuration on disk is byte-for-byte unchanged
