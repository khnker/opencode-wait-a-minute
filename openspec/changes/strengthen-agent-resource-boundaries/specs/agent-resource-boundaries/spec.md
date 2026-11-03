# Agent Resource Boundaries

## ADDED Requirements

### Requirement: Default Resource Limits Are Deterministic
The system SHALL expose frozen default agent resource limits with
`maxResultBytes: 65536`, `maxFindings: 100`, `maxDecisions: 50`,
`maxArtifacts: 50`, `maxEvidence: 100`, `maxInvocations: 16` and
`maxInvocationMs: 300000`.

#### Scenario: Defaults are read-only
- **WHEN** a caller inspects the default limits
- **THEN** the limits SHALL be frozen and SHALL match the documented values

#### Scenario: Defaults are reused across runs
- **WHEN** two orchestrations run without overrides
- **THEN** both SHALL resolve the same limit values without mutating global state

### Requirement: Limit Overrides Are Validated
The system SHALL merge caller-provided limit overrides over the defaults and
SHALL reject non-positive or non-integer limits, a negative `maxInvocationMs`,
or unsupported limit keys.

#### Scenario: Valid overrides are merged
- **WHEN** a caller supplies `{ maxFindings: 5, maxInvocationMs: 0 }`
- **THEN** the resolved limits SHALL use those values and keep the other defaults

#### Scenario: Invalid overrides fail loud
- **WHEN** a caller supplies a zero collection limit, a negative timeout or an
  unknown key
- **THEN** resolution SHALL throw `RoleContractError` with stable issues

### Requirement: Result Byte Boundary
The system SHALL reject an agent result whose serialized JSON exceeds
`maxResultBytes` with a `RoleContractError` carrying a stable issue.

#### Scenario: Oversized result is rejected
- **WHEN** an invocation result serializes to more than the configured byte limit
- **THEN** `assertInvocationResult` SHALL throw `RoleContractError` with an issue
  starting with `result exceeds maxResultBytes`

#### Scenario: Small result passes
- **WHEN** an invocation result is structurally valid and within every limit
- **THEN** `assertInvocationResult` SHALL return the result and metadata unchanged

### Requirement: Collection Boundaries
The system SHALL reject results whose `findings`, `decisions`, `artifacts` or
`evidence` collections exceed their configured limits.

#### Scenario: Findings exceed the limit
- **WHEN** a result carries more findings than `maxFindings`
- **THEN** validation SHALL throw `RoleContractError` identifying
  `result.findings exceeds maxFindings`

#### Scenario: Other collections exceed their limits
- **WHEN** decisions, artifacts or evidence exceed their limits
- **THEN** validation SHALL report a stable issue for each exceeded collection

### Requirement: Invocation Budget
The orchestrator SHALL enforce a global `maxInvocations` budget before each
adapter call and SHALL fail loud when the next invocation would exceed it.

#### Scenario: Budget is exhausted
- **WHEN** the pipeline attempts an invocation beyond `maxInvocations`
- **THEN** the orchestrator SHALL throw `AgentOrchestrationError` including the
  attempted count, the limit, the role and the invocation id
- **AND** the adapter SHALL NOT receive that invocation

### Requirement: Invocation Deadline
The orchestrator SHALL enforce an optional `maxInvocationMs` deadline around
`adapter.invoke`, SHALL clear the timer after the race settles, and SHALL treat
`0` as disabled.

#### Scenario: Adapter hangs
- **WHEN** an adapter does not settle within `maxInvocationMs`
- **THEN** the orchestrator SHALL throw `AgentOrchestrationError` identifying the
  role and invocation id
- **AND** the pending adapter rejection SHALL NOT become an unhandled rejection

#### Scenario: Deadline disabled
- **WHEN** `maxInvocationMs` is `0`
- **THEN** the orchestrator SHALL await `adapter.invoke` without a timer

### Requirement: Valid Flows Stay Unchanged
Existing orchestrations that stay within the defaults SHALL behave exactly as
before.

#### Scenario: Small four-role pipeline
- **WHEN** a valid adapter returns small results for ANALYST, ARCHITECT, BUILDER
  and REVIEWER
- **THEN** the orchestrator SHALL complete the same pipeline, handoffs and result
  set as before this change
