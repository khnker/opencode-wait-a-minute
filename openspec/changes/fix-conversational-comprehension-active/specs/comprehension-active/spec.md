# Spec: Conversational comprehension active

## ADDED Requirements

### Requirement: Pragmatic intent comprehension

The system MUST capture subtle user intent and the shared understanding behind a message before acting.

#### Scenario: Pragmatic intent

- **GIVEN** user input with subtle or implicit intent
- **WHEN** WAM analyzes the message
- **THEN** it records the shared understanding and uses it for the next step
