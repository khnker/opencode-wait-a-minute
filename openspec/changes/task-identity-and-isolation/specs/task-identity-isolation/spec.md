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

### Requirement: Loop snapshots are scoped to the attempt
A persisted loop snapshot MUST only be resumed for the same task and session. A
snapshot from another attempt MUST be discarded. A `STOPPED` snapshot MUST
surface its stop decision once, then its counters MUST NOT leak into the next
recorded attempt.

#### Scenario: Foreign snapshot discarded
- **WHEN** a loop snapshot belongs to a different task or session
- **THEN** the driver starts a fresh loop state
- **AND** the prior stop state is not inherited

#### Scenario: Stop surfaces once
- **WHEN** a `STOPPED` snapshot is resumed for the same attempt
- **THEN** the stop decision surfaces once
- **AND** the next recorded attempt starts with fresh counters

### Requirement: Decoupled duplicate detection
Duplicate detection MUST propose candidates rather than forcing identity takeover.

#### Scenario: Duplicate candidate suggestion
- **WHEN** a similar prompt arrives without an explicit task ID in a new session while an existing task is in progress
- **THEN** the engine MUST detect a duplicate candidate
- **AND** MUST require explicit continuation evidence before takeover
