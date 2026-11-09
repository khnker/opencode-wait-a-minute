## ADDED Requirements

### Requirement: Prompt transport errors carry a WAM error code

The invocation adapter SHALL wrap a raw provider `response.error` from a prompt
in a WAM error before returning it to callers, so every prompt failure has a
stable `code` consumable by `isRetryableAgentError`.

#### Scenario: Retryable transport status

- **WHEN** a provider response contains an error with a missing status, 408,
  409, 425, 429 or a status >= 500
- **THEN** the adapter raises an error with `code` `PROMPT_FAILED`
- **AND** `isRetryableAgentError` returns `true`

#### Scenario: Terminal client status

- **WHEN** a provider response contains an error with status 400, 401, 403, 404
  or 422
- **THEN** the adapter raises an error with `code` `INVALID_RESULT`
- **AND** `isRetryableAgentError` returns `false`

#### Scenario: Diagnostics and session continuity are preserved

- **WHEN** the adapter wraps a provider prompt error
- **THEN** the wrapped error keeps the original `sessionID`
- **AND** keeps the raw provider error as `cause`

#### Scenario: Successful prompt is unchanged

- **WHEN** a provider response has no `error`
- **THEN** the adapter returns the prompt result without wrapping

#### Scenario: Task loop does not park on a transient transport failure

- **WHEN** a prompt fails with `PROMPT_FAILED`
- **THEN** the task loop retries within its existing budget instead of parking
  the run at `WAITING_USER`
