# RC1 Phase 1 Regression and Test Gate

## ADDED Requirements

### Requirement: Classification category execution
The release gate MUST execute all classification categories and exit non-zero on any failure.

#### Scenario: Failure exits non-zero
- **WHEN** any classification category fails
- **THEN** the release gate MUST exit non-zero

### Requirement: State isolation
State isolation MUST ensure there is no cross-test pollution in `.wam`.

#### Scenario: No `.wam` pollution
- **WHEN** tests run against `.wam`
- **THEN** no cross-test state pollution MUST occur

### Requirement: Regression coverage
Completion, lifecycle, continuation, admission, evidence, and persistence regressions MUST be fully covered by automated assertions.

#### Scenario: Regression domains asserted
- **WHEN** the regression gate runs
- **THEN** automated assertions MUST cover completion, lifecycle, continuation, admission, evidence, and persistence
