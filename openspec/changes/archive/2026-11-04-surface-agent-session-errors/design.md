## Context

`invokeAgent` in `src/agents/invocation-adapter.js` reads the prompt response and
only checks the top-level `response.error`. The legacy endpoint returns
`{ info: { error }, parts: [] }`, so the nested error is skipped and the empty
`parts` array produces `agent response is empty` (`INVALID_RESULT`).

## Research

- OpenCode server OpenAPI (`/doc`): `POST /session/{id}/message` returns the
  assistant message object with `info` and `parts`; errors are carried on
  `info.error` as `{ name, data: { message, statusCode, isRetryable } }`.
- Existing adapter contract: `AgentInvocationError` codes
  (`PROMPT_FAILED`, `PROMPT_TIMEOUT`, `INVALID_RESULT`) plus `sessionID` and
  `cause`, consumed by `formatAgentFailure`.

## Alternatives

1. **Check only `response.error` (status quo).** Rejected: hides nested errors.
2. **Treat any `info.error` as `INVALID_RESULT`.** Rejected: the failure is a
   prompt/provider failure, not a malformed result; callers and `formatAgentFailure`
   need the provider detail.
3. **Raise `PROMPT_FAILED` with provider message/status and `cause`.** Chosen:
   preserves the existing code taxonomy and makes the persisted reason actionable.

## Decision

Add `sessionErrorMessage(data)` that reads `data.info.error ?? data.error`, builds
`agent session error: <message> (<status>)`, and throws `PROMPT_FAILED` with the
raw error as `cause` before result parsing. The outer parse guard rethrows
`AgentInvocationError` unchanged, so `sessionID` and `cause` survive.
