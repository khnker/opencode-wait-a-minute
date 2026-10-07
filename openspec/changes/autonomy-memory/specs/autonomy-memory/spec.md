# Design: Autonomy Memory

## ADDED Requirements
### Requirement: Cognitive State Persistence
Cognitive state (hypotheses, experiments, observations) MUST be persisted to durable storage and loaded on task resume.
#### Scenario: State survives session boundary
- **WHEN** a task is paused and later resumed
- **THEN** active hypotheses, rejected hypotheses, completed experiments, and critical observations are restored from `.wam/task/cognition.json`
### Requirement: Memory Compaction Rules
The system MUST apply compaction rules to cognitive state: KEEP active/rejected hypotheses, completed experiments, critical observations; DROP redundant observations, transient narration; NEVER convert hypothesis→fact or interpretation→evidence.
#### Scenario: Compaction preserves critical insights
- **WHEN** cognitive state exceeds storage limits
- **THEN** redundant observations and transient narration are dropped while active hypotheses and completed experiments are retained