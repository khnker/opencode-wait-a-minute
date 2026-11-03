# Agent result boundaries

## ADDED Requirements

### Requirement: Coordinator validates every invocation result before use

The orchestrator MUST call the shared result-boundary validator on every
`adapter.invoke` result before the result is pushed into `results`, accumulated into
`handoffs`, findings, artifacts, evidence or constraints, or used for a task decision.

#### Scenario: Valid result is validated then accepted

- **WHEN** an adapter returns a result that satisfies the schema and is bound to the request
- **THEN** the orchestrator validates it and continues with the existing control flow

#### Scenario: Validation precedes accumulation

- **WHEN** an adapter returns any result
- **THEN** the orchestrator validates it before mutating any orchestration state

### Requirement: Identity binding is enforced centrally

The shared validator MUST verify that the result `taskId`, `invocationId` and `role` match
the originating request, regardless of which adapter produced the result.

#### Scenario: Task mismatch is rejected

- **WHEN** a result carries a `taskId` different from `request.taskId`
- **THEN** validation reports an identity issue for `taskId`

#### Scenario: Invocation mismatch is rejected

- **WHEN** a result carries an `invocationId` different from `request.invocationId`
- **THEN** validation reports an identity issue for `invocationId`

#### Scenario: Role mismatch is rejected

- **WHEN** a result carries a `role` different from `request.role`
- **THEN** validation reports an identity issue for `role`

### Requirement: Role capability claims are enforced

The validator MUST reject a result that claims capabilities its role does not hold:
non-empty `decisions` requires `getRoleCapabilities(role).proposeDecisions === true`,
`review` is REVIEWER-only, and completion or global-state claims MUST be impossible.
`artifacts` and `evidence` are references, not capability claims.

#### Scenario: Decisions from a non-proposing role are rejected

- **WHEN** a BUILDER result contains a non-empty `decisions` array
- **THEN** validation rejects the result with a capability violation

#### Scenario: Decisions from a proposing role are accepted

- **WHEN** an ANALYST, ARCHITECT or REVIEWER result contains `decisions`
- **THEN** validation accepts the capability claim

#### Scenario: Review payload is REVIEWER-only

- **WHEN** a non-REVIEWER result contains a `review` payload
- **THEN** validation rejects the result

#### Scenario: Completion and global-state claims are impossible

- **WHEN** a result attempts to declare completion approval or global-state modification
- **THEN** the result schema rejects it as an unknown top-level key

### Requirement: Invalid results fail with orchestration context and cause

A rejected result MUST surface as `AgentOrchestrationError` carrying the underlying
validation error as `cause` plus the offending role and invocation identifiers. It MUST NOT
be downgraded to a warning or silently dropped.

#### Scenario: Orchestrator wraps validation failure

- **WHEN** the shared validator throws `RoleContractError` during orchestration
- **THEN** the orchestrator throws `AgentOrchestrationError` with `cause` set to that error and role/invocation context in the message

### Requirement: Rejected results have no side effects

A rejected result MUST NOT modify accumulated context, handoffs, results or WAM task state.
No partial handoff may be produced.

#### Scenario: No partial state after rejection

- **WHEN** an invalid result is rejected mid-run
- **THEN** `results`, `handoffs`, findings, artifacts, evidence, constraints and WAM task state remain as they were before the invocation

### Requirement: Adapter still fails fast on transport corruption

The invocation adapter MUST continue to throw `AgentInvocationError` with code
`INVALID_RESULT` for malformed invocations or results, using the shared identity check and
preserving `cause` and `sessionID`.

#### Scenario: Malformed result at the adapter

- **WHEN** the adapter receives a result failing schema or identity validation
- **THEN** it throws `AgentInvocationError` with code `INVALID_RESULT` and the original cause

### Requirement: Valid results pass through unchanged

Validation MUST NOT mutate valid results or their metadata, and downstream consumers MUST
receive the same values the adapter produced.

#### Scenario: Valid result is unchanged

- **WHEN** a valid result passes the shared validator
- **THEN** the returned `result` and `metadata` reference unmodified data and the orchestrator accumulates exactly that result
