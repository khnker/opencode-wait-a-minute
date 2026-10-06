# Fail-Closed Completion

## ADDED Requirements

### Requirement: Fail-Closed Completion
Completion MUST fail closed: unknown, ambiguous, missing-evidence or invalid-state conditions MUST yield NOT VERIFIED.

#### Scenario: Unknown fails closed
- **WHEN** the state is unknown
- **THEN** completion returns NOT VERIFIED


#### Scenario: Exception never succeeds
- **WHEN** an internal error occurs
- **THEN** completion does NOT report success

