# Task Identity and Isolation

## ADDED Requirements

### Requirement: Explicit task precedence
The engine MUST prioritize the explicit `taskId` provided in the input over any heuristic or duplicate detection.

#### Scenario: Explicit task ID wins
- **WHEN** an input arrives with `taskId: "task-B"` while an active task A exists and the prompt is similar to task A
- **THEN** the engine MUST resolve to `task-B` without triggering duplicate reassignment

### Requirement: Session isolation
Sessions MUST NOT leak task state across different session IDs.

#### Scenario: Cross-session isolation
- **WHEN** session B sends a prompt while session A is bound to task A
- **THEN** session B MUST NOT automatically inherit task A without explicit session binding or a resume command

### Requirement: Decoupled duplicate detection
Duplicate detection MUST propose candidates rather than forcing identity takeover.

#### Scenario: Duplicate candidate suggestion
- **WHEN** a similar prompt arrives without an explicit task ID in a new session while an existing task is in progress
- **THEN** the engine MUST detect a duplicate candidate
- **AND** MUST require explicit continuation evidence before takeover
