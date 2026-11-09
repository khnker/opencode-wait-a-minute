# Retry Transport Errors From Agent Prompts

## Why

When a provider rejects or fails a prompt at the transport layer, the raw
`response.error` escapes the invocation adapter without a WAM error `code`.
`isRetryableAgentError` therefore cannot classify it, treats HTTP 429/5xx as
terminal, and the task loop parks the run at `WAITING_USER` instead of retrying.
Transient provider pressure becomes a permanent stop.

## What Changes

- Wraps raw provider prompt errors with `promptErrorFromResponse()` at the
  invocation-adapter boundary.
- Classifies a missing status, 408, 409, 425, 429 and any status >= 500 as
  `PROMPT_FAILED` (retryable).
- Classifies 400, 401, 403, 404 and 422 as `INVALID_RESULT` (terminal).
- Preserves `sessionID` and `cause` on the wrapped error so diagnostics and
  session continuity survive classification.
- Adds regression tests for retryable 429 and terminal 403.

## Impact

- `src/agents/invocation-adapter.js`
- `tests/unit/agent-invocation-adapter.test.mjs`
- `openspec/changes/agent-transport-error-retry/**` (new)
- No change to retry policy, the task-loop state machine or provider adapters.

## Non-Goals

- Adding new provider transports.
- Changing `isRetryableAgentError` or the task loop's retry budget.
- Retrying terminal client errors (auth, validation, not-found).
- Backoff, jitter or circuit-breaker policy.
