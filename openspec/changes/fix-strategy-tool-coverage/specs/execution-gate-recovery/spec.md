# Change: Fix strategy tool coverage and orphan execution gates

## ADDED Requirements
### Requirement: Release orphan same-process gates
WAM MUST clear an active execution gate owned by the current process when its loop status is terminal (`STOPPED` or `COMPLETED`) and no agent pass is in flight for that task.

#### Scenario: terminal loop releases the gate
- GIVEN an active gate owned by the current process
- AND a loop state with status `STOPPED`
- AND no agent pass in flight for the task
- WHEN a mutating tool call is evaluated
- THEN the gate MUST be cleared and the mutation MUST proceed

#### Scenario: running loop keeps blocking
- GIVEN an active gate owned by the current process
- AND a loop state with status `RUNNING`
- WHEN a mutating tool call is evaluated
- THEN the mutation MUST stay blocked
