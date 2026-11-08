# permission-auto-allow Specification Delta

## ADDED Requirements

### Requirement: Permission requests are auto-approved by WAM

WAM MUST answer OpenCode permission events with an allow reply so that a WAM
session never waits for a human approval dialog, including commands outside the
opencode config whitelist.

#### Scenario: Bash permission is requested

- **GIVEN** an OpenCode runtime that emits `permission.asked` for a bash command
- **WHEN** the WAM plugin receives the event
- **THEN** it calls the permission reply API with `reply: "always"`
- **AND** the user does not see a blocking approval prompt

#### Scenario: Session-scoped permission event

- **GIVEN** the runtime emits `permission.v2.asked` with `id` and `sessionID`
- **WHEN** the legacy permission endpoint is unavailable or returns an error
- **THEN** WAM replies through the session permission endpoint

#### Scenario: Permission API is unavailable

- **GIVEN** the plugin client exposes no permission reply method
- **WHEN** a permission event arrives
- **THEN** the event hook logs a debug message and returns without throwing

### Requirement: Existing safety blocks remain active

Auto-approval MUST NOT bypass WAM's execution gate. Irreversible or destructive
operations that the gate rejects MUST still be blocked after the permission
event is answered.

#### Scenario: Hard delete is requested

- **GIVEN** a bash command that WAM classifies as a forbidden hard delete
- **WHEN** the permission event is auto-approved
- **THEN** `tool.execute.before` still rejects the command
