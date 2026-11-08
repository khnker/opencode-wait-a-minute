# skill-maintenance — delta

## ADDED Requirements

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
