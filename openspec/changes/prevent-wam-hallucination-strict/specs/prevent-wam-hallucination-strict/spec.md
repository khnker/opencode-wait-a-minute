# Spec: prevent-wam-hallucination-strict

## ADDED Requirements

### Requirement: Prevent Hallucinated Completion States
The system MUST ensure that task requirements default to pending and are never auto-completed or marked verified without explicit execution evidence.

#### Scenario: Fresh task initialization
- Given a new task session
- When the task state is created or loaded
- Then all requirements remain pending until verified by explicit execution.
