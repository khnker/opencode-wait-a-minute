## ADDED Requirements

### Requirement: Task-scoped decisions

The semantic projection SHALL include a decision only when it belongs to the
current task: its id or text references the task id or a requirement id, or
its id carries no `task-…`/`ses-…` scope marker (project-wide decision).

#### Scenario: Decision from another session is omitted

- **WHEN** a decision id is scoped to a different session than the task
- **THEN** the projection omits it from `decisions`
- **AND** its id remains in `retrievableRefs`

#### Scenario: Project-wide decision is kept

- **WHEN** a live decision id has no scope marker
- **THEN** the projection includes it in `decisions`

#### Scenario: Repeated decisions collapse

- **WHEN** several task-linked decisions share the same normalized text
- **THEN** only the most recent one is projected

### Requirement: One representation per fact

The rendered projection SHALL render pending obligations once and SHALL bound
retrieval handles.

#### Scenario: Pending obligation renders once

- **WHEN** the projection has a pending obligation
- **THEN** it appears in `open items`
- **AND** it does not also appear in `execution state`

#### Scenario: Retrieval handles stay bounded

- **WHEN** the projection has many retrievable refs
- **THEN** the rendered line reports the count and at most four base-entry refs
- **AND** the rendered text stays within `maxChars`
