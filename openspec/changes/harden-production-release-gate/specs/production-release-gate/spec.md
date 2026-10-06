# Production Release Gate

## ADDED Requirements

### Requirement: Production gate must validate the release artifact

The plugin MUST load successfully and the production smoke test MUST pass when a clean package is installed.

#### Scenario: Clean package installation
- **WHEN** the package is built using `npm pack`
- **AND** the generated tarball is installed into a clean directory
- **THEN** the plugin MUST load successfully
- **AND** the production smoke test MUST pass

### Requirement: Governance must be release-gated

The production gate MUST enforce that unapproved mutations are blocked.

#### Scenario: Unapproved mutation
- **WHEN** a contract is not approved
- **AND** a mutating operation is attempted
- **THEN** the operation MUST be blocked
- **AND** the production gate MUST pass this invariant

### Requirement: Completion must require evidence

The production gate MUST enforce that completion requires valid evidence.

#### Scenario: Missing evidence
- **WHEN** requirements are not supported by valid evidence
- **AND** completion is attempted
- **THEN** completion MUST be rejected
- **AND** the production gate MUST detect the invariant if it regresses

### Requirement: Task isolation must be release-gated

The production gate MUST enforce task isolation.

#### Scenario: Cross-task authorization
- **WHEN** Task A has authorization
- **AND** Task B is active
- **AND** Task B attempts to use Task A authorization
- **THEN** the operation MUST be blocked

### Requirement: Audit input must fail closed

The audit command MUST fail with a command-error status when the audit configuration is malformed.

#### Scenario: Invalid audit configuration
- **WHEN** the audit configuration is malformed
- **AND** the audit gate executes
- **THEN** the audit command MUST fail with a command-error status

### Requirement: Continuation must preserve the fast path

The runtime MUST NOT perform a full context rebuild when continuation executes for a task that doesn't require context reconstruction.

#### Scenario: Verified continuation
- **WHEN** a task has already reached a state where continuation does not require context reconstruction
- **AND** continuation executes
- **THEN** the runtime MUST NOT perform a full context rebuild
- **AND** MUST NOT perform other unnecessary operations unnecessary full registry scan

### Requirement: Heuristic audit findings are diagnostic

Behavioral audit classifications MUST NOT independently fail the production gate unless an explicit deterministic threshold contract exists.

#### Scenario: Heuristic findings diagnostic only
- **WHEN** heuristic audit findings are generated
- **THEN** they MUST NOT independently fail the production gate
- **AND** MUST be strictly diagnostic unless an explicit deterministic threshold contract exists

### Requirement: Production gate is authoritative

The Production Gate MUST be the final authority in a WAM session for any mutation. No other audit system overrides or replaces it.

#### Scenario: Production gate authority
- **WHEN** a mutation is attempted
- **THEN** the Production Gate MUST be the final authority
- **AND** no other audit system MAY override or replace it
