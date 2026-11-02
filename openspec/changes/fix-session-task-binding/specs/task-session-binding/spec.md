# Task session binding

## ADDED Requirements

### Requirement: Per-session task persistence

WAM MUST persist the active task binding for each session that supplies a
`sessionId`, and MUST resolve that session's task from the persisted binding
before consulting the global active-task pointer.

#### Scenario: Another session overwrites the global pointer

- **WHEN** session A has task `task-a-sess-aaaaaaaa` and session B writes the
  global active-task with `task-b-sess-bbbbbbbb`
- **THEN** resolving session A returns `task-a-sess-aaaaaaaa`

#### Scenario: Restart with a sidecar

- **WHEN** a session has `.wam/session-tasks/<sessionId>.json` and the process
  restarts
- **THEN** the first resolution for that session returns the bound task

### Requirement: Legacy task recovery

WAM MUST recover a session's task when no sidecar exists but a task directory
is namespaced to that session.

#### Scenario: No sidecar, matching suffix

- **WHEN** `.wam/tasks/task-roadmap-sess-abcdefgh` exists and session
  `ses_...abcdefgh` resolves its task
- **THEN** WAM returns `task-roadmap-sess-abcdefgh`

#### Scenario: Multiple matching tasks

- **WHEN** several task directories match the session suffix
- **THEN** WAM returns the one with the newest `task.json` modification time

### Requirement: Session-less compatibility

WAM MUST keep the global active-task pointer and its 60-second TTL for callers
that do not supply a `sessionId`.

#### Scenario: CLI without session

- **WHEN** a caller reads the active task without a `sessionId` and the record
  is older than 60 seconds
- **THEN** WAM returns no task
