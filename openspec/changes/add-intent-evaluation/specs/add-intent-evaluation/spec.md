# Spec: Intent evaluation

## ADDED Requirements

### Requirement: Intent changes are measured

Every intent/context change MUST report intent accuracy, clarification rate, contract acceptance and context token cost on the scenario suite.

#### Scenario: Compare two routers
- **GIVEN** two intent-router versions
- **WHEN** the scenario suite runs
- **THEN** a per-metric delta is produced
- **AND** regressions are visible
