# Production Validation

## ADDED Requirements

### Requirement: Production gate SHALL validate critical execution invariants

Project SHALL provide deterministic production-validation gate that verifies execution, assessment, evidence, completion and recovery invariants before release is considered valid.

#### Scenario: All production invariants pass
- GIVEN clean project installation
- WHEN complete production-validation gate is executed
- THEN all mandatory scenarios pass
- AND command exits with status 0.

#### Scenario: A critical invariant fails
- GIVEN any mandatory production scenario fails
- WHEN production-validation gate is executed
- THEN command exits non-zero
- AND release gate MUST NOT proceed.

### Requirement: False completion SHALL be rejected

WAM SHALL prevent task from reaching DONE when execution evidence contradicts claimed completion.

#### Scenario: Agent claims DONE after contradictory execution
- GIVEN execution result contradicts expected requirement
- WHEN completion is evaluated
- THEN requirement is not verified
- AND task is not marked DONE.

### Requirement: Inconclusive observations SHALL remain inconclusive

WAM SHALL preserve insufficient observations as INCONCLUSIVE rather than converting them into success or unsupported failure.

#### Scenario: No sufficient observation
- GIVEN execution does not provide sufficient evidence
- WHEN observation is assessed
- THEN assessment remains INCONCLUSIVE
- AND completion gate does not accept it as verification.

### Requirement: Repetitive strategy failures SHALL stop looping

WAM SHALL detect repeated failure of same strategy across persisted execution state.

#### Scenario: Same strategy fails repeatedly
- GIVEN same strategy repeatedly produces same relevant failure
- WHEN another attempt would repeat strategy
- THEN WAM blocks repetition
- AND requires diagnosis or replanning.

### Requirement: Recovery SHALL preserve semantic state

WAM SHALL recover persisted execution state after process interruption without fabricating or duplicating semantic evidence.

#### Scenario: Process restarts mid-experiment
- GIVEN experiment is persisted before process termination
- WHEN WAM restarts and resumes task
- THEN persisted state remains internally consistent
- AND recovery does not create duplicate semantic observations or evidence.

### Requirement: Sessions SHALL remain isolated

WAM SHALL isolate cognition and active execution state between concurrent independent sessions.

#### Scenario: Two tasks execute concurrently
- GIVEN two independent tasks are active
- WHEN both persist observations and evidence
- THEN each task can recover only its own state
- AND neither task changes other's completion state.

### Requirement: Sensitive values SHALL not leak into persisted artifacts

WAM SHALL prevent credential-like values from being persisted into cognition, evidence, audit or telemetry artifacts.

#### Scenario: Tool result contains a secret
- GIVEN tool result contains token, password or API key
- WHEN result is persisted
- THEN sensitive value is redacted or excluded
- AND no persisted production artifact contains original secret.