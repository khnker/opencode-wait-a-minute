# Spec: Completion strict

## ADDED Requirements

### Requirement: Strict completion intent

The system MUST match only explicit closure commands as completion intent.

#### Scenario: Normal sentence

- **GIVEN** a normal sentence that is not a closure claim
- **WHEN** evaluated for completion intent
- **THEN** it returns false
