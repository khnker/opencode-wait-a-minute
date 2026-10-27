# Specs: Fix Durable State

## MODIFIED Requirements

### Requirement: Atomic Write Protection
The system MUST write task state atomically to prevent corruption during concurrent access.

#### Scenario: Atomic Write Protection
- **GIVEN** concurrent writes to task state file
- **WHEN** `saveTaskState` is called
- **THEN** state is written atomically using temporary file + rename

### Requirement: Fail-Loud Parse Errors
The system MUST throw clear errors when encountering corrupted task state files, never silently substitute with `{}`.

#### Scenario: Fail-Loud Parse Errors
- **GIVEN** corrupted task state file
- **WHEN** `loadTaskState` is called
- **THEN** clear error is thrown, not silent substitution with `{}`

#### Scenario: Unknown Status Surface
- **GIVEN** task state file with unknown per-task status
- **WHEN** loading state
- **THEN** error is thrown/surfaced, not silently skipped

### Requirement: Migration Runner Execution
The system MUST execute migrations in ascending version order with actual apply/up functions, not silently drop unknown statuses.

#### Scenario: Migration Runner Execution
- **GIVEN** pending migrations of different versions
- **WHEN** migration runner is executed
- **THEN** migrations run in ascending version order with actual apply/up functions