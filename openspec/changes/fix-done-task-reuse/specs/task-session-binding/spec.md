# Task session binding

## ADDED Requirements

### Requirement: New instructions do not reuse a DONE task

WAM MUST NOT bind a new non-continuation instruction to the session's cached or
active task when that task's phase is `DONE`. It MUST derive a new task id so
the normal task loop and agent pass can run.

#### Scenario: Cached DONE task

- **WHEN** a session is bound to a `DONE` task and the user sends a new
  instruction
- **THEN** `effectiveTaskId` returns a different task id
- **AND** `shouldRunTaskAgentPass` on the resulting task is eligible to run

#### Scenario: Session-namespace collision

- **WHEN** the derived fallback id equals the skipped `DONE` task id
- **THEN** WAM appends a numeric suffix instead of reusing the `DONE` task

#### Scenario: Cold-cache DONE task

- **WHEN** neither the session cache nor the active pointer holds a task, but a
  derived fallback id already exists on disk with phase `DONE`
- **THEN** WAM appends a numeric suffix instead of reusing the `DONE` task

### Requirement: Continuations keep binding to the existing task

WAM MUST keep binding explicit continuation prompts and synthetic auto-loop
prompts to the existing task, including when its phase is `DONE`, so the
completion flow is unchanged.

#### Scenario: Continuation after DONE

- **WHEN** the session task is `DONE` and the prompt is a continuation or an
  auto-loop synthetic prompt
- **THEN** `effectiveTaskId` returns the existing task id
