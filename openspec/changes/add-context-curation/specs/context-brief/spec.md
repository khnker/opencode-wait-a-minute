# Spec: Context brief

## ADDED Requirements

### Requirement: Compaction receives a structured brief

The system MUST inject a bounded context brief before OpenCode generates a compaction summary.

#### Scenario: Compaction hook

- **GIVEN** an active task with requirements and decisions
- **WHEN** `experimental.session.compacting` runs
- **THEN** `output.context` contains the task objective, open requirements, decisions and entities
- **AND** the brief is bounded

### Requirement: Compaction is triggered automatically

The system MUST trigger `session.summarize` when an assistant message reports tokens above the configured threshold.

#### Scenario: Token threshold crossed

- **GIVEN** an assistant message with 100,000 or more total tokens
- **WHEN** the `message.updated` event is processed
- **THEN** WAM calls `session.summarize` once for that session
- **AND** summary messages do not trigger compaction again
