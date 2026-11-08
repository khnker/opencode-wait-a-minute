# skill-maintenance — delta

## ADDED Requirements

### Requirement: Every bundled skill is audited against the reduction policy
The repository SHALL classify each bundled skill by type and reduction level, applying
`R0` when no meaningful reduction is safe.

#### Scenario: Compact skill is left unchanged
- **WHEN** a skill has no significant redundancy or no-op content
- **THEN** its reduction level is `R0`
- **AND** it is not shortened for its own sake

#### Scenario: Reduction level is explicit
- **WHEN** the reduction report is read
- **THEN** each audited skill has a type, an `R0`..`R5` level, and a before/after size

### Requirement: Reductions preserve behavior
A reduced skill SHALL keep its activation conditions, decision rules, constraints,
failure handling, and important edge cases.

#### Scenario: Diagnostic rigor is preserved
- **WHEN** `diagnosing-bugs` is reduced
- **THEN** the reproduction loop, minimization, hypothesis falsification, root cause,
  fix, regression, and cleanup stages remain

#### Scenario: Verification order is preserved
- **WHEN** `tdd` is reduced
- **THEN** the red-green-refactor order, transition conditions, and failure handling
  remain

#### Scenario: Router boundaries are preserved
- **WHEN** a router skill is reduced
- **THEN** activation, exclusion, classification, destination, and contextual loading
  rules remain

### Requirement: Reductions are guarded by a structural regression
The repository SHALL keep a test manifest with maximum sizes and required behavior
markers for reduced skills.

#### Scenario: A reduced skill regrows
- **WHEN** a reduced skill exceeds its manifest size or loses a required marker
- **THEN** the regression test fails

#### Scenario: The policy is not duplicated
- **WHEN** a skill other than `writing-for-agents` is reduced
- **THEN** the reduction policy itself is not copied into that skill
