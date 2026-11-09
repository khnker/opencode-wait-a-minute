# Spec: Correction flow edit access

## ADDED Requirements

### Requirement: Correction flows are never blocked by contract approval

The system MUST allow contract-gated tools in a correction flow even when
contract approval is `required`.

#### Scenario: Correction lane
- **GIVEN** a task with `flow: "correction"`, a `PROPOSED` contract and pending requirements
- **WHEN** `enforceGovernance` gates `edit` with `requireApproval: true`
- **THEN** the decision is `{ allowed: true, reason: "correction-flow" }`

#### Scenario: Debugging task kind
- **GIVEN** a task whose contract kind is `debugging`
- **WHEN** a `write` tool is gated
- **THEN** the decision is `{ allowed: true, reason: "correction-flow" }`

### Requirement: Development flows keep the approval gate

The system MUST keep blocking contract-gated tools for non-correction flows when
`contractApproval` is `required`.

#### Scenario: Implementation task
- **GIVEN** a non-correction task with a `PROPOSED` contract and pending requirements
- **WHEN** `enforceGovernance` is called with `requireApproval: true`
- **THEN** the decision is `{ allowed: false, reason: "contract-not-approved" }`
