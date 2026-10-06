# Runtime Task Isolation

## ADDED Requirements

### Requirement: Operations must have an explicit task scope
Governed operations MUST resolve the current session and task identity.

#### Scenario: Missing task
- **WHEN** a governed mutating operation executes
- **AND** no current task can be resolved
- **THEN** the operation MUST be blocked

### Requirement: Authorization must be task-bound
An authorization granted to one task MUST NOT authorize another task.

#### Scenario: Cross-task authorization
- **WHEN** Task A has an approved contract
- **AND** Task B is active
- **AND** a mutating operation belonging to Task B is attempted using Task A state
- **THEN** the operation MUST be blocked

### Requirement: Task switching must invalidate task-specific authorization
Task switching MUST invalidate task-specific authorization.

#### Scenario: Switching tasks
- **WHEN** Task A is approved and the runtime switches to Task B
- **THEN** Task A authorization MUST NOT be used for Task B
- **AND** Task B state MUST be resolved independently

### Requirement: Evidence must remain task-local
Evidence produced for Task A MUST NOT satisfy requirements for Task B.

#### Scenario: Cross-task evidence
- **WHEN** Task A has verified evidence
- **AND** Task B has an equivalent requirement
- **AND** Task B evaluates completion
- **THEN** Task A evidence MUST NOT satisfy Task B

### Requirement: Sub-sessions require explicit inheritance
A child session MUST identify its parent session and task when inheriting capabilities. A sub-session MUST NOT bypass task governance merely because it has a parent.

#### Scenario: Child session identifies parent
- **WHEN** a child session inherits capabilities from a parent session
- **THEN** the child session MUST identify its parent session and task

#### Scenario: Sub-session does not bypass governance
- **WHEN** a sub-session has a parent session
- **THEN** it MUST NOT bypass task governance merely because of that parent

### Requirement: Ambiguous scope must fail closed
A governed mutation with ambiguous or inconsistent task scope MUST be blocked.

#### Scenario: Ambiguous task scope blocks mutation
- **WHEN** a governed mutation has ambiguous or inconsistent task scope
- **THEN** the operation MUST be blocked
