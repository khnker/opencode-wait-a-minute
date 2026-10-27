# Spec: Structured contract

## ADDED Requirements

### Requirement: Contracts have a structured shape

A synthesized contract MUST contain objective, deliverables, constraints, non-goals and acceptance criteria.

#### Scenario: Actionable task
- **GIVEN** "implementa un endpoint OAuth2 con validación de tokens y tests"
- **WHEN** the contract is extracted
- **THEN** objective is non-empty
- **AND** deliverables include the endpoint and the tests
- **AND** requirements are derived from the deliverables

#### Scenario: Prose without deliverables
- **GIVEN** "analiza si hay problemas, revisa logs y dime cómo corregirlo"
- **WHEN** the contract is extracted
- **THEN** no fabricated requirement is produced
- **AND** the contract is marked NEEDS_CLARIFICATION or CONVERSATION
