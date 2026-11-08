# Spec: Visible user-facing WAM notices

## ADDED Requirements

### Requirement: User-facing WAM notices render in opencode web

The runtime SHALL make the blocked completion directive, the advisory completion
gate notice and the completion notice visible in the opencode web session body,
without changing the user message parts or the text sent to the model.

#### Scenario: Blocked DONE shows the directive

- **GIVEN** an opt-in completion-gate session with pending requirements
- **WHEN** the agent claims DONE and the gate blocks
- **THEN** the block directive is queued for the session
- **AND** after the assistant message finishes, a synthetic text part containing
  the directive is appended to that assistant message
- **AND** the web timeline renders the directive text

#### Scenario: Allowed DONE shows the completion notice

- **GIVEN** an opt-in completion-gate session whose requirements are all verified
- **WHEN** the agent claims DONE and the gate allows it
- **THEN** the completion notice is queued for the session
- **AND** after the assistant message finishes, a synthetic text part containing
  the notice is appended to that assistant message
- **AND** the web timeline renders the notice text

#### Scenario: Advisory gate shows the recommendation

- **WHEN** the gate returns an advisory verdict with pending requirements
- **THEN** the advisory notice is queued and appended the same way

#### Scenario: Prompt immutability and extraction

- **WHEN** a visible notice is queued
- **THEN** the user message parts are not modified
- **AND** `extractPrompt` still returns the user's text
- **AND** the model input continues to receive the same synthetic WAM context

### Requirement: Visible notices are bounded and fail soft

The runtime SHALL bound and deduplicate the per-session notice queue and MUST
NOT fail the chat turn when the assistant-part endpoint is unavailable or
errors.

#### Scenario: Duplicate notice

- **WHEN** the same notice text is queued twice for a session
- **THEN** it is queued once

#### Scenario: Queue bound

- **WHEN** more than five distinct notices are queued for a session
- **THEN** only the five most recent are kept

#### Scenario: Part endpoint failure

- **WHEN** appending the notice part fails or the endpoint is unavailable
- **THEN** the failure is logged as a warning
- **AND** the chat turn continues without throwing

#### Scenario: Session deletion

- **WHEN** a session is deleted
- **THEN** any queued notices for that session are discarded

### Requirement: Quoted `/wam ctx get` query

The `/wam ctx get` command SHALL strip one pair of matching surrounding single
or double quotes before retrieving context.

#### Scenario: Quoted query

- **WHEN** the user runs `/wam ctx get "completion gate enforcement"`
- **THEN** the retrieval query is `completion gate enforcement`
- **AND** the response does not report a query with literal quote characters
