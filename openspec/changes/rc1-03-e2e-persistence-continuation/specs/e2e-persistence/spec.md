# E2E Persistence / Continuation

## ADDED Requirements

### Requirement: E2E Persistence / Continuation
Interrupted tasks MUST resume with the same identity and preserved state, with no duplication or false completion.

#### Scenario: Resume preserves identity
- **WHEN** a task is interrupted and a new session starts
- **THEN** the same task id is recovered

#### Scenario: No false completion
- **WHEN** the task resumes incomplete
- **THEN** completion is NOT declared
