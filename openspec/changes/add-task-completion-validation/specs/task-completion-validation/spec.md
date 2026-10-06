# Task Completion Validation

## ADDED Requirements

### Requirement: Dependent task completion
A task MUST only transition to `complete` when all dependent sub-tasks are `complete`.

#### Scenario: Incomplete sub-task blocks completion
- **WHEN** a task has at least one sub-task that is not `complete`
- **THEN** the task MUST NOT transition to `complete`

#### Scenario: All sub-tasks complete
- **WHEN** all sub-tasks of a task are `complete`
- **THEN** the task MAY transition to `complete`
