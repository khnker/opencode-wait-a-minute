# Agent task execution

## ADDED Requirements

### Requirement: Persisted task snapshots keep their identity

An agent step MUST receive the active task id even when the persisted
`task.json` payload omits it. The supplied id MUST be used for every worker
invocation, and an explicit `id`, `taskId` or `task_id` on the snapshot MUST
take precedence.

#### Scenario: Snapshot without id

- **WHEN** `maybeTaskLoop` loads a task whose payload has no identity
- **THEN** it passes the active `taskId` to the agent step
- **AND** the orchestration invokes every role with that task id
- **AND** the loop persists the resulting `agentRun`
