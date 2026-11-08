# skill-maintenance Specification

## Purpose
TBD - created by archiving change add-skill-reduction-policy. Update Purpose after archive.
## Requirements
### Requirement: Skill reduction has one authoritative policy
`writing-for-agents` SHALL expose the reduction policy, and other skills SHALL NOT copy
the policy into their bodies.

#### Scenario: Editing a skill activates the policy
- **WHEN** an agent creates, edits, prunes, or restructures a skill
- **THEN** the `writing-for-agents` description matches that task
- **AND** its `Skill reduction` section points to `references/skill-reduction.md`

#### Scenario: Policy is not duplicated
- **WHEN** another skill is updated
- **THEN** it does not contain a second copy of the reduction contract

### Requirement: Reduction preserves behavior
A reduction SHALL lower context cost without changing activation, decisions,
constraints, or failure handling.

#### Scenario: Contract is complete
- **WHEN** the reduction reference is read
- **THEN** it contains the nine contract steps
- **AND** it covers `RED-01` through `RED-10`

#### Scenario: Validation is mandatory
- **WHEN** a reduction is proposed
- **THEN** it is validated for activation, precision, constraints, coverage,
  independence, regression, and token cost
- **AND** a shorter file alone is not accepted as evidence

### Requirement: Reduction severity and type rules are explicit
The policy SHALL define the preferred operation order and type-specific posture.

#### Scenario: Severity order is preserved
- **WHEN** the reference is read
- **THEN** it lists `R0` through `R5`
- **AND** it states the preferred order `R1` → `R2` → `R3` → `R4` → `R5`

#### Scenario: Type posture is actionable
- **WHEN** an engineer classifies a skill as router, engineering, diagnostic,
  verification, architecture, UI, prototype, handoff, or meta-skill
- **THEN** the reference states what to preserve, what to remove, and the decision
  criterion for that type

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

