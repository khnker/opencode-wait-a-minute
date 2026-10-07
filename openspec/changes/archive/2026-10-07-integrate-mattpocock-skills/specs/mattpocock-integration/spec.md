# MattPocock Integration Spec

## ADDED Requirements

### Requirement: Skill File Layout

Each vendored skill SHALL live in `skills/<skill-id>/SKILL.md`.

#### Scenario: Structure per skill
- GIVEN skill "diagnosing-bugs"
- WHEN discovered
- THEN `skills/diagnosing-bugs/SKILL.md` SHALL exist
- AND frontmatter SHALL include `name`, `description`, `disable-model-invocation` (optional)

### Requirement: Routing Constraints

Each new skill SHALL be registered in `DEFAULT_CONSTRAINTS` in `skill-routing.js`.

#### Scenario: Constraint lookup
- GIVEN skill "handoff" in registry
- WHEN `getSkillConstraints("handoff")` called
- THEN SHALL return `{ allowedLayers, dependsOn, conflicts, reason }`

### Requirement: Source Attribution

Vendored skills SHALL retain original author attribution in frontmatter `source` or `description`.

#### Scenario: Attribution check
- GIVEN skill "tdd"
- THEN description SHALL mention "mattpocock/skills" or source field SHALL include original repo