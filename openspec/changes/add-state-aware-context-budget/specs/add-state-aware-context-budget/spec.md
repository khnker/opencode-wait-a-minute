# Spec: State-aware context budget

## ADDED Requirements

### Requirement: Context budget depends on state

The context assembler MUST apply a different budget and source mix per conversation/task state.

#### Scenario: Conversation
- **GIVEN** the CONVERSATION lane
- **WHEN** context is assembled
- **THEN** no task contract or historical decisions are injected

#### Scenario: Task
- **GIVEN** the TASK_NEW lane
- **WHEN** context is assembled
- **THEN** project summary and contract are injected
- **AND** the token cap is respected
