# Skill Discovery
## ADDED Requirements
### Requirement: Discovery metadata describes activation, not workflow
A skill's `description` MUST describe WHEN to activate the skill and MUST NOT summarize the
skill workflow. The frontmatter MUST expose `name`, `description`, `triggers`, `keywords`.
#### Scenario: Description summarizes workflow
- **WHEN** a skill description encodes the workflow steps
- **THEN** validation warns or fails, and the body is still required for behavior

### Requirement: Layered loading
Skills MUST load in layers: always-loaded metadata, then the SKILL.md body on activation,
then references/resources only when needed.
#### Scenario: Activation
- **WHEN** a skill is activated
- **THEN** its SKILL.md body is loaded, not its full references

### Requirement: Context cost is measured and bounded
The system MUST measure `skill_context_tokens`, `reference_context_tokens`,
`total_skill_cost` and `activation_frequency`, and MUST bound skill context via the context
budget/admission mechanism.
#### Scenario: Metrics per activation
- **WHEN** a skill is activated
- **THEN** its context tokens and cumulative activation frequency are recorded
#### Scenario: Over budget
- **WHEN** activating skill content would exceed the reserved context budget
- **THEN** it is admitted or rejected per the budget policy
