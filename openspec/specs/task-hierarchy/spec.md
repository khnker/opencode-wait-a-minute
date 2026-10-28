# task-hierarchy Specification

## Purpose
TBD - created by archiving change add-task-hierarchy. Update Purpose after archive.
## Requirements
### Requirement: Optional hierarchy fields on task records

Task records SHALL accept optional `parentId`, `scope` and `sessionId` fields, where
`scope` is one of the phase 1 `CONTEXT_SCOPE_TYPES` (`project`, `group`, `task`,
`session`). Records without these fields SHALL remain valid and behave as before.

#### Scenario: Legacy task without hierarchy fields

- **WHEN** a task record has no `parentId`, `scope` or `sessionId`
- **THEN** it loads unchanged and validates as a root task
- **AND** it resolves to `scope: "project"` with itself as `projectId`

#### Scenario: Session task carries its session id

- **WHEN** a task has `scope: "session"` and a `sessionId`
- **THEN** ancestry resolution reports that `sessionId`

### Requirement: Link validation never writes on failure

The system SHALL validate a proposed parent link without throwing. It SHALL reject a
missing task, a missing parent, a self-parent, a cycle, or a parent whose scope is not
strictly shallower than the child's (`project > group > task > session`). A rejected
link SHALL NOT modify the task record.

#### Scenario: Self parent

- **WHEN** a task is linked to itself
- **THEN** validation returns `ok: false`
- **AND** the stored `parentId` is unchanged

#### Scenario: Cycle

- **WHEN** linking a task under one of its own descendants
- **THEN** validation reports a cycle
- **AND** no file is written

#### Scenario: Invalid level ordering

- **WHEN** a `group` task is linked under a `session` task
- **THEN** validation reports invalid level ordering
- **AND** the stored `parentId` is unchanged

#### Scenario: Missing parent

- **WHEN** the requested parent does not exist
- **THEN** the result contains an error instead of throwing

### Requirement: Ancestry and effective scope resolution

The system SHALL return the ordered root→leaf ancestry of a task and derive
`{ scope, projectId, groupId, sessionId }` from it.

#### Scenario: Full chain

- **WHEN** tasks form a valid `project → group → task → session` chain
- **THEN** ancestry returns all four records root→leaf
- **AND** effective scope reports the project, group and session ids

### Requirement: Constraints inherit without history

The system SHALL return constraints inherited from project and group ancestors only,
deduped and in ancestry order. It SHALL NOT include task entries, history or session
constraints.

#### Scenario: Constraint inheritance

- **WHEN** a session task has project, group, task and session ancestors with constraints
- **THEN** only project/group constraints are returned
- **AND** duplicates across those ancestors appear once

### Requirement: Bounded consolidation into the parent group

The system SHALL append a summary `{ taskId, requirementsDone, nextAction, at }` to the
parent group's `consolidated` array. Consolidation SHALL be deduped by `taskId`, capped
at 20 entries, idempotent for the same `taskId` and source `updatedAt`, and SHALL NOT
write the canonical project base or sibling tasks.

#### Scenario: Idempotent consolidation

- **WHEN** the same child with the same `updatedAt` is consolidated twice
- **THEN** the group contains one summary and the second call reports no change

#### Scenario: Bounded consolidation

- **WHEN** more than 20 distinct children are consolidated into one group
- **THEN** only the 20 most recent summaries are retained

#### Scenario: Confined to the parent group

- **WHEN** one child of a group is consolidated
- **THEN** the summary appears only on that group
- **AND** sibling tasks and the canonical base are unchanged

