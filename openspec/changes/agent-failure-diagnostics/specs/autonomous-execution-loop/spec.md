## ADDED Requirements

### Requirement: Agent prompt failures expose structured provider data

The system SHALL include the provider message, error code and HTTP status from
the thrown error and its cause chain in `agentRun.failureReason` when an agent
pass fails because `client.session.prompt` rejects. The traversal MUST be
bounded to three cause levels and the result MUST be capped at 300 characters.

#### Scenario: HTTP-shaped cause is surfaced

- **WHEN** `client.session.prompt` rejects with an `APIError`-shaped cause
  carrying `data.message: "session is busy"` and `data.statusCode: 409`
- **THEN** `formatAgentFailure` returns
  `failed to prompt agent session; code=PROMPT_FAILED; cause: session is busy status=409`

#### Scenario: Output stays bounded

- **WHEN** the cause chain is longer than three levels or the message exceeds
  300 characters
- **THEN** only the first three causes are rendered
- **AND** the final string is truncated to 300 characters

### Requirement: Reopening a terminal agent run clears the stale failure

The system SHALL remove `failureReason` when `reopenTerminalAgentRun` reopens a
`FAILED`, `BLOCKED` or `NEEDS_INPUT` run, as well as resetting the terminal
fields, so a reopened run cannot keep reporting a previous failure.

#### Scenario: Failure reason is cleared on reopen

- **WHEN** a terminal run carries `failureReason: "failed to prompt agent session"`
- **THEN** `reopenTerminalAgentRun` sets `status`, `verdict` and `stoppedAt` to
  `null`, sets `exhausted` and `surfaced` to `false`
- **AND** `failureReason` is absent from the reopened run
- **AND** the prior `results` history is preserved
