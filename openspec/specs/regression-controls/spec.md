# regression-controls Specification

## Purpose
Define the correctness controls for the context-efficiency benchmark. These controls assert that the optimization never corrupts state or hides negative results: no stale or invalid snapshot is classified `VALID`, no required rebuild is skipped, no stale context reaches execution, verification is never lost, and negative savings are never clamped to zero. They deliberately do not assert that WAM always saves tokens.
## Requirements
### Requirement: Regression Controls
The benchmark MUST contain explicit assertions that protect the optimization's correctness, and MUST NOT assert that WAM always saves tokens.

#### Scenario: No False VALID
- **WHEN** the regression suite runs
- **THEN** it asserts that no stale or invalid snapshot is classified `VALID`

#### Scenario: No Skipped Rebuild
- **WHEN** the regression suite runs
- **THEN** it asserts that no required rebuild is skipped

#### Scenario: No Stale Context
- **WHEN** the regression suite runs
- **THEN** it asserts that no stale task state or stale project context reaches execution

#### Scenario: No Lost Verification
- **WHEN** the regression suite runs
- **THEN** it asserts that verification is never lost

#### Scenario: No Clamping
- **WHEN** the regression suite runs
- **THEN** it asserts that negative savings are not clamped to zero

### Requirement: Charts
The benchmark MUST generate charts that expose the causal mechanism and preserve controls.

#### Scenario: Rebuild vs Token Cost
- **WHEN** charts are generated
- **THEN** context rebuild count is shown alongside input-token consumption

#### Scenario: Savings by Scenario
- **WHEN** charts are generated
- **THEN** positive and negative results are shown without removing controls

#### Scenario: Continuation Scaling
- **WHEN** charts are generated
- **THEN** token consumption is shown as the number of turns increases

#### Scenario: Snapshot State
- **WHEN** charts are generated
- **THEN** the number of executions classified as `VALID`, `STALE`, and `INVALID` is shown

### Requirement: Aggregation
Aggregated savings MUST be reported together with workload composition.

#### Scenario: Composition Context
- **WHEN** aggregated savings are reported
- **THEN** the report states the number of scenarios, number of runs, number of negative controls, verification success, and token source

#### Scenario: No Bare Aggregate
- **WHEN** a single aggregate percentage is presented
- **THEN** it includes the workload composition context

