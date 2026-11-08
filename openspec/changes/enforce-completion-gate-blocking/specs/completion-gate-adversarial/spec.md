# Spec: Completion gate enforcement

## ADDED Requirements

### Requirement: Completion gate enforcement mode

The completion gate SHALL support an opt-in enforcement mode. When the mode is
enabled, a DONE claim that the strict gate reports as blocked MUST remain
blocked, and the merged pending reasons MUST be returned. When the mode is
disabled, the existing advisory downgrade MUST remain unchanged.

#### Scenario: Enforce blocks an unverified DONE claim
- **GIVEN** `completionGate.enforce` is true and a requirement is not verified
- **WHEN** the agent claims DONE
- **THEN** the gate returns `blocked: true` and `advisory: false`
- **AND** the pending reasons name the unverified requirement

#### Scenario: Enforce allows a verified DONE claim
- **GIVEN** `completionGate.enforce` is true and every requirement is verified
- **WHEN** the agent claims DONE
- **THEN** the gate returns `allDone: true` and does not block

#### Scenario: Legacy advisory behavior is unchanged
- **GIVEN** `completionGate.enforce` is false or absent
- **WHEN** the strict gate reports a blocked DONE claim
- **THEN** the gate returns `blocked: false, advisory: true` with the existing recommendation

### Requirement: Visible blocked completion validation

The completion validation text SHALL distinguish a blocked verdict from an
advisory verdict. A blocked verdict MUST produce a directive that names the
missing reasons and instructs the agent to continue; an advisory verdict MUST
keep the current recommendation wording.

#### Scenario: Blocked claim surfaces a directive
- **WHEN** `buildCompletionValidation` receives a blocked gate with pending reasons
- **THEN** the text states that completion is blocked
- **AND** the text lists the pending reasons

#### Scenario: Advisory claim surfaces a recommendation
- **WHEN** `buildCompletionValidation` receives an advisory gate
- **THEN** the text keeps the recommendation wording and does not claim a hard block
