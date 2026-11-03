# Approved Agent Strategy

## ADDED Requirements

### Requirement: Deterministic Approved Strategy
The system SHALL build a single approved strategy object per orchestration run
from the ARCHITECT decisions and the constraints accumulated at that point.

#### Scenario: Building a strategy
- **WHEN** ARCHITECT completes successfully with decisions and the orchestrator builds the approved strategy
- **THEN** the strategy SHALL contain `version: 1`, `source: "ARCHITECT"`,
  `approvedBy: "ORCHESTRATOR"`, the ARCHITECT decisions as
  `{id, description, rationale}`, and the current constraints as strings
- **AND** the strategy and its nested decisions and constraint list SHALL be
  frozen
- **AND** building twice from the same inputs SHALL produce deep-equal objects
  with no timestamps or random values

### Requirement: Strategy Validation
The system SHALL reject malformed approved strategies with a `RoleContractError`
carrying stable, path-prefixed issues.

#### Scenario: Invalid version
- **WHEN** a strategy has a version other than 1
- **THEN** validation SHALL fail with an issue stating that the version must be 1

#### Scenario: Invalid provenance
- **WHEN** `source` is not `"ARCHITECT"` or `approvedBy` is not `"ORCHESTRATOR"`
- **THEN** validation SHALL fail and name the offending field

#### Scenario: Invalid collection shapes
- **WHEN** `decisions` or `constraints` is not an array, a decision is missing a
  non-empty `id`, `description`, or `rationale`, decision ids are duplicated, a
  constraint is not a non-empty string, or an unknown key is present
- **THEN** validation SHALL fail with an issue identifying the offending path

### Requirement: Role-Scoped Strategy Handoff
The orchestrator SHALL attach the current approved strategy to BUILDER requests
and SHALL NOT expose it to ANALYST or REVIEWER requests.

#### Scenario: BUILDER receives the strategy
- **WHEN** ARCHITECT completes and the orchestrator invokes BUILDER
- **THEN** the BUILDER request input SHALL include `approvedStrategy` matching the
  strategy built from that ARCHITECT result

#### Scenario: Other roles do not receive the strategy
- **WHEN** the orchestrator invokes ANALYST or REVIEWER
- **THEN** those request inputs SHALL NOT include `approvedStrategy`

### Requirement: Replan Replaces the Strategy
The orchestrator SHALL replace the approved strategy whenever ARCHITECT runs
again after a REPLAN_REQUIRED verdict.

#### Scenario: Strategy replacement on replan
- **WHEN** the REVIEWER returns `REPLAN_REQUIRED` and ARCHITECT completes again
- **THEN** the next BUILDER request SHALL contain a strategy built from the new
  ARCHITECT decisions
- **AND** the previous strategy SHALL NOT be reused or merged

### Requirement: Missing Strategy Fails Loud
The orchestrator SHALL refuse to invoke BUILDER without an approved strategy.

#### Scenario: BUILDER invoked without a strategy
- **WHEN** BUILDER is invoked while no approved strategy exists
- **THEN** the orchestrator SHALL throw `AgentOrchestrationError` explaining
  that an approved strategy from ARCHITECT is required

### Requirement: Request Contract Accepts the Strategy
The agent request contract SHALL accept `approvedStrategy` as an optional input
key and validate its shape when present.

#### Scenario: Valid strategy in a request
- **WHEN** a request input includes a well-formed approved strategy
- **THEN** request validation SHALL accept it

#### Scenario: Invalid strategy in a request
- **WHEN** a request input includes a malformed approved strategy
- **THEN** request validation SHALL report issues identifying the invalid fields
