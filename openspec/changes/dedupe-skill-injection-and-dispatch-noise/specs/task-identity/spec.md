# task-identity — delta

## ADDED Requirements
### Requirement: Subagent dispatches do not create slug tasks
Task id derivation SHALL skip prompt-slug creation for sessions with a parent.
#### Scenario: Delegated worker session
- **WHEN** a session has a resolved `parentID`
- **THEN** no `task-<dispatch-slug>` id is created
- **AND** the session-scoped fallback id is used
