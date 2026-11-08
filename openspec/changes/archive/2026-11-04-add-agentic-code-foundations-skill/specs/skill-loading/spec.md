# skill-loading — delta

## ADDED Requirements
### Requirement: Agentic code foundations skill is discoverable and routable
The bundled local skill `agentic-code-foundations` SHALL be discovered from
`skills/<id>/SKILL.md`, registered as APPROVED with on-demand loading, and selected for
refactor/maintainability prompts.
#### Scenario: Skill discovered from the bundled skills directory
- **WHEN** `discoverSkills({ root: process.cwd() })` runs
- **THEN** the result contains `agentic-code-foundations`
- **AND** its path ends with `skills/agentic-code-foundations/SKILL.md`
#### Scenario: Registry entry is approved and on demand
- **WHEN** the registry is built from discovered skills
- **THEN** the entry status is `APPROVED`
- **AND** `risk` is `low`
- **AND** `loadStrategy` is `ondemand`
- **AND** capabilities and triggers are non-empty
#### Scenario: Refactor prompt selects the skill
- **WHEN** a prompt asks to refactor code for maintainability and agent-readable clarity
- **THEN** `routeSkillsV2` selects `agentic-code-foundations`
- **AND** the skill is not marked as a base skill
#### Scenario: Constraint allows every layer
- **WHEN** the skill constraint is read
- **THEN** `allowedLayers` includes backend, frontend, shared and infrastructure
