# subagent-model-availability — delta

## ADDED Requirements
### Requirement: role-based-tier-routing
The system SHALL resolve each subagent type to a tier by role, and the
resolution SHALL drive pre-dispatch model selection and escalation.
#### Scenario: execution agents route to fast
- **WHEN** a `backend-exec`, `frontend-exec`, or `debugger` subagent is dispatched
- **THEN** its base tier is `fast`
#### Scenario: analysis agents route to medium
- **WHEN** a `planner` or `arch-review` subagent is dispatched
- **THEN** its base tier is `medium`
#### Scenario: execution failure escalates to medium
- **WHEN** an execution subagent accumulates 2 consecutive failures
- **THEN** the effective tier escalates from `fast` to `medium`
#### Scenario: unknown type fails open
- **WHEN** the subagent type is unknown or missing
- **THEN** the base tier falls back to `medium`
