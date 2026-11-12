# Spec: Agent flow autonomy — continue on new evidence

## ADDED Requirements

### Requirement: Grounded continuation is automatic

The system MUST continue a real non-DONE task automatically when the user shows
continuation intent or supplies corrective evidence, without requiring a slash
command.

#### Scenario: Pending task continues
- **GIVEN** a session with a non-DONE task in the active pointer
- **WHEN** the user sends "sigamos" (or another continuation phrase) without a task id
- **THEN** WAM adopts the pending task and continues it
- **AND** WAM does not ask the user to run `/wam resume`

#### Scenario: No resume command exists
- **WHEN** the user sends `/wam resume <id>`
- **THEN** the command is not handled as a resume command
- **AND** the help/usage output never lists `resume`

### Requirement: Unresolved continuation intent asks

When continuation intent cannot be grounded in a real pending task, WAM MUST ask
instead of fabricating a task.

#### Scenario: No pending task
- **GIVEN** no non-DONE task is resolvable
- **WHEN** the user sends "sigamos"
- **THEN** WAM emits the no-active-task notice
- **AND** WAM does not create or continue a task from the vague prompt
