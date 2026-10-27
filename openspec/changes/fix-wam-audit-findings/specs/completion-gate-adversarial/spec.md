# Specs: Fix Completion-Gate Adversarial

## MODIFIED Requirements

### Requirement: Evidence Required for Both Done and Verified
The system MUST require non-empty evidence for BOTH "done" and "verified" statuses. Tasks cannot be marked verified without evidence that satisfies all pending requirements.

#### Scenario: Evidence Required for Done Status
- **GIVEN** a task with pending requirements
- **WHEN** evaluating completion for "done" status
- **THEN** all requirements must have evidence, or validation fails

#### Scenario: Evidence Required for Verified Status
- **GIVEN** a task with pending requirements
- **WHEN** evaluating completion for "verified" status  
- **THEN** all requirements must have evidence, or validation fails

### Requirement: Completion Gate State-Based Evaluation
The system MUST evaluate completion based on real state (requirements, unknowns, assumptions, contract status) rather than natural language prompt detection alone.

#### Scenario: Completion Gate Without Natural Language Prompt
- **GIVEN** a task in any completion phase (in-progress, review, done, verified)
- **WHEN** evaluating completion gate without natural language prompt
- **THEN** it evaluates real state (requirements, unknowns, assumptions, contract status)

#### Scenario: Prompt Text as Additional Signal
- **GIVEN** a task with completion requirements
- **WHEN** natural language prompt is detected but requirements are not met
- **THEN** completion detection must still fail regardless of prompt text