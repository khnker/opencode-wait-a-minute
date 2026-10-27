# Spec: Clarification policy

## ADDED Requirements

### Requirement: Clarify only when necessary

The system MUST ask a blocking question only when the decision is critical, unresolved by context and high-cost to get wrong.

#### Scenario: Resolved by history
- **GIVEN** a decision-critical uncertainty already answered in history
- **WHEN** the policy evaluates it
- **THEN** the system assumes the historical answer and continues

#### Scenario: High-risk ambiguity
- **GIVEN** an irreversible deletion without scope or target
- **WHEN** the policy evaluates it
- **THEN** the system asks a targeted question
