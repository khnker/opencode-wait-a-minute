# RC1 Phase 1 Regression Gate

## ADDED Requirements

### Requirement: Categorized suite execution
The RC1 release gate MUST execute all categorized test suites and report counts.

#### Scenario: All suites executed
- **WHEN** the RC1 release gate runs
- **THEN** every categorized test suite MUST execute
- **AND** the gate MUST report per-suite counts

### Requirement: Suite state isolation
State leakage between test suites MUST be prevented.

#### Scenario: No cross-suite leakage
- **WHEN** multiple test suites run in sequence
- **THEN** state from one suite MUST NOT leak into another

### Requirement: Completion vocabulary safeguards
Completion vocabulary rules MUST prevent false positives.

#### Scenario: False positive rejected
- **WHEN** completion vocabulary could produce a false positive
- **THEN** the rule MUST reject it

### Requirement: Matrix invariants enforced
Task lifecycle, continuation, and admission matrices MUST strictly enforce their invariants.

#### Scenario: Matrix invariant violation
- **WHEN** a lifecycle, continuation, or admission matrix invariant is violated
- **THEN** the gate MUST fail
