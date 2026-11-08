# Agent Invocation

## ADDED Requirements

### Requirement: Task agent passes are non-interactive

WAM role invocations MUST NOT expose the interactive `question` tool. A role
that needs information MUST return it in `openQuestions` instead of asking the
user from its child session.

#### Scenario: Read-only role policy

- **GIVEN** the `ANALYST`, `ARCHITECT` or `REVIEWER` role
- **WHEN** the adapter derives its tool policy
- **THEN** `question` is `false`

#### Scenario: Builder role policy

- **GIVEN** the `BUILDER` role
- **WHEN** the adapter derives its tool policy
- **THEN** `question` is `false`

#### Scenario: Role prompt forbids questions

- **GIVEN** any role prompt
- **WHEN** the system prompt is built
- **THEN** it instructs the role not to ask the user questions
- **AND** it directs unknowns to `openQuestions`
