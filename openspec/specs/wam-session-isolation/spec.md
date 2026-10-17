# wam-session-isolation Specification

## Purpose
TBD - created by archiving change fix-wam-session-isolation-and-observability. Update Purpose after archive.
## Requirements
### Requirement: Task identity must be isolated per session

The system SHALL resolve task identity with an explicit session binding so that two sessions using the same prompt slug never share task state.

#### Scenario: Two sessions with identical prompt
- **WHEN** two independent sessions start a task with identical prompt text
- **THEN** each session resolves to a distinct task directory under `.wam/tasks/`
- **AND** neither session reads or writes the other session's task state

### Requirement: Snapshot continuation must validate ownership

The system SHALL validate `projectRoot`, `taskId`, and `sessionId` before authorizing a continuation fast-path.

#### Scenario: Snapshot belonging to another session
- **WHEN** a continuation is evaluated against a snapshot whose `sessionId` differs from the current session
- **THEN** the fast-path is rejected
- **AND** full context is reconstructed instead of reusing the mismatched snapshot

### Requirement: Message injection must be observable

The system SHALL report the outcome of every WAM text injection attempt with a structured status.

#### Scenario: Injected output has no valid target
- **WHEN** `emitTextPart` cannot find a valid `parts` or `system` target
- **THEN** it returns an explicit `unsupported-output-shape` status
- **AND** records a structured log event rather than failing silently

### Requirement: Concurrent sessions must not contaminate active-task state

The system SHALL scope `.wam/active-task` and in-memory session stores strictly by session ID.

#### Scenario: Concurrent active task updates
- **WHEN** two sessions update their active task concurrently
- **THEN** each session's active task remains independent
- **AND** restarting OpenCode preserves each session's active task

