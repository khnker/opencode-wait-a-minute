# Runtime Task Isolation

## Requirement: Operations must have an explicit task scope

Governed operations MUST resolve the current session and task identity.

### Scenario: Missing task

* GIVEN a governed mutating operation
* AND no current task can be resolved
* WHEN the operation executes
* THEN the operation is blocked

## Requirement: Authorization must be task-bound

An authorization granted to one task MUST NOT authorize another task.

### Scenario: Cross-task authorization

* GIVEN Task A has an approved contract
* AND Task B is active
* WHEN a mutating operation belonging to Task B is attempted using Task A state
* THEN the operation is blocked

## Requirement: Task switching must invalidate task-specific authorization

### Scenario: Switching tasks

* GIVEN Task A is approved
* WHEN the runtime switches to Task B
* THEN Task A authorization MUST NOT be used for Task B
* AND Task B state MUST be resolved independently

## Requirement: Evidence must remain task-local

Evidence produced for Task A MUST NOT satisfy requirements for Task B.

### Scenario: Cross-task evidence

* GIVEN Task A has verified evidence
* AND Task B has an equivalent requirement
* WHEN Task B evaluates completion
* THEN Task A evidence MUST NOT satisfy Task B

## Requirement: Sub-sessions require explicit inheritance

A child session MUST identify its parent session and task when inheriting capabilities.

A sub-session MUST NOT bypass task governance merely because it has a parent.

## Requirement: Ambiguous scope must fail closed

A governed mutation with ambiguous or inconsistent task scope MUST be blocked.
