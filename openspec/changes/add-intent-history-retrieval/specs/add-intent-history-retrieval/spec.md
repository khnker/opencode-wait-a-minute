# Spec: Intent history retrieval

## ADDED Requirements

### Requirement: Historical context is retrieved by relevance

The system MUST rank historical decisions, contracts and recent changes by a hybrid score and inject only entries above a threshold.

#### Scenario: Relevant prior decision
- **GIVEN** a prior decision about OAuth2 token rotation and a new OAuth2 task
- **WHEN** historical context is retrieved
- **THEN** the decision is included
- **AND** unrelated entries are excluded

#### Scenario: No relevant history
- **GIVEN** a new task unrelated to stored history
- **WHEN** retrieval runs
- **THEN** no historical entry is injected
