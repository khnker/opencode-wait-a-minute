# WAM Architecture Taxonomy

## ADDED Requirements

### Requirement: Canonical Pillar Taxonomy
The architecture MUST define the pillars `preflight`, `context`, `task`, `execution`, `verification`, `skills`, `runtime`, plus `orchestration` and `shared`, each with an explicit ownership description.

#### Scenario: Every module has an owner
- **WHEN** the ownership map is produced
- **THEN** every production module is assigned exactly one semantic owner

#### Scenario: New code placement is unambiguous
- **WHEN** a maintainer adds a module
- **THEN** the taxonomy determines its location without inspecting unrelated modules

### Requirement: Dependency Direction
Dependencies MUST flow `runtime adapters → orchestration → pillars → shared`; pillars MUST NOT depend on orchestration and `shared` MUST NOT depend on domain pillars.

#### Scenario: Dependency violation is detected
- **WHEN** a module imports against the allowed direction
- **THEN** the violation is recorded in the ownership map

#### Scenario: Shared stays domain-neutral
- **WHEN** a helper contains domain semantics
- **THEN** it is owned by a pillar, not placed in `shared`
