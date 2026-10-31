# Spec: Zero-friction advisory policy

## ADDED Requirements

### Requirement: WAM never requests approval

The system MUST NOT emit prompts that ask the human to approve or reject WAM state, and
MUST NOT return a blocking decision from `permission.ask`, delegation preflight,
governance enforcement or the completion gate for workflow reasons.

#### Scenario: Contract is proposed
- **GIVEN** a task whose contract status is `PROPOSED`
- **WHEN** the context is assembled
- **THEN** the injected text contains a recommendation line
- **AND** it does not contain "¿Apruebo" nor "Responde sí"

#### Scenario: Delegated tool call
- **GIVEN** a subagent tool call with no granted permission plan
- **WHEN** `permission.ask` is evaluated
- **THEN** the hook returns `allow`
- **AND** `delegationBlocked(state).blocked` is `false`

#### Scenario: Incomplete requirements
- **GIVEN** a state with unverified requirements
- **WHEN** the completion gate is evaluated
- **THEN** it returns `blocked: false`, `advisory: true` and lists `unresolvedRequirements`
- **AND** a `recommendation` string is provided

### Requirement: Recommendations replace restrictions

The system MUST express every former restriction as an injected recommendation that
names the concrete next action or command, while allowing the operation to proceed.

#### Scenario: Governance advisory
- **GIVEN** a contract-gated tool while the contract is not approved
- **WHEN** governance is enforced
- **THEN** the decision is `{ allowed: true, reason: "advisory" }`
- **AND** it carries a recommendation mentioning `/wam contract approve`

### Requirement: Irreversible operations still block

The system MUST keep blocking irreversible or destructive operations (hard delete, U1
soft-archive violations) and corrupt-state validation.

#### Scenario: Hard delete
- **GIVEN** a `bash` call matching a hard-delete pattern
- **WHEN** the execution guard runs
- **THEN** the decision is `allowed: false` with reason `hard delete forbidden`
