## ADDED Requirements

### Requirement: Agent failures preserve their cause

The system SHALL record the underlying provider error when an agent session
finishes with an error and no text, instead of reporting an empty response.

#### Scenario: Provider error without text parts

- **WHEN** the session prompt response contains `info.error` and no text parts
- **THEN** the invocation fails with `PROMPT_FAILED`
- **AND** the message includes the provider message and status code when present
- **AND** the original error is retained as `cause`
- **AND** the persisted loop failure reason includes that message
