## ADDED Requirements

### Requirement: repetition-detection
The system SHALL detect repeated identical tool invocations using a normalized (tool, input) key.

#### Scenario: repetition-block
**WHEN** an identical tool invocation exceeds the threshold, **THEN** the system SHALL force a checkpoint and emit a STOP/ESCALATE directive.

### Requirement: step-budget
The system SHALL enforce a configurable session step budget.

#### Scenario: state-reset
**WHEN** the system state changes (e.g., file digest updated), **THEN** the repetition count SHALL reset for that tool key.
