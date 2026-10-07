# Design: Durable State

## ADDED Requirements
### Requirement: Atomic State Writes
All state writes MUST be atomic (write-temp + rename) to avoid torn files, schema-validated before commit, and carry a stateVersion and lastModifiedAt timestamp.
#### Scenario: Atomic write prevents corruption
- **WHEN** a state write is interrupted mid-operation
- **THEN** the original state file remains intact and no corrupted file is committed
### Requirement: State Read Validation
Reads MUST validate schema before hydration; corrupted state is quarantined and reported; reads return immutable views to prevent accidental mutation.
#### Scenario: Corrupted state quarantined
- **WHEN** a state file fails schema validation on read
- **THEN** the state is quarantined and an error is reported rather than returning corrupted data
### Requirement: Recovery Protocol
On agent startup, the system MUST load state-index.json, attempt hydration for each unfinished task, mark failed hydrations as NEEDS_RECOVERY with a recovery prompt, and resume from the last durable checkpoint.
#### Scenario: Recovery prompt on hydration failure
- **WHEN** a task's state cannot be hydrated on startup
- **THEN** the task is marked NEEDS_RECOVERY and a recovery prompt is emitted
### Requirement: Per-task Ordering
Per-task ordering (assessment → plan → evidence → completion) MUST be enforced; cross-task concurrent tasks do not share mutable state without explicit synchronization.
#### Scenario: Ordering enforced
- **WHEN** evidence is written before assessment for a task
- **THEN** the write is rejected as violating per-task ordering
### Requirement: Query API
A stateQuery({ taskId, type, since, until }) API MUST return matching state entries for use by drift reports, audit, and the dev dashboard.
#### Scenario: Query filters by task and type
- **WHEN** stateQuery is called with taskId and type filters
- **THEN** only matching state entries are returned