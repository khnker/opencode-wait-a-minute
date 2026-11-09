# Design — Retry Transport Errors From Agent Prompts

## Context

The invocation adapter receives provider responses whose `error` field may be a
raw provider object. Before this change that object escaped unchanged, so the
error had no WAM `code` and `isRetryableAgentError` fell back to treating it as
terminal. A 429 or 5xx response then parked the run at `WAITING_USER`.

## Decision

Normalize at the adapter boundary with `promptErrorFromResponse(response)`:

| Provider signal | WAM code | Retryable |
| --- | --- | --- |
| missing status, 408, 409, 425, 429, >= 500 | `PROMPT_FAILED` | yes |
| 400, 401, 403, 404, 422 | `INVALID_RESULT` | no |

The wrapper keeps `sessionID` and `cause` (the original provider error) so logs
retain the raw payload while callers get a stable contract. The classifier and
the retry predicate keep a single authority: the adapter assigns the `code`,
`isRetryableAgentError` interprets it.

## Alternatives Considered

1. **Chosen — adapter-boundary normalization.** One classification table, one
   authority, providers stay dumb and callers get a stable `code`.
2. **Rejected — teach `isRetryableAgentError` to inspect raw provider payloads.**
   Couples the retry classifier to every provider shape and still leaves callers
   without a stable `code`.
3. **Rejected — retry every prompt error.** Retries auth/validation failures,
   burns budget and masks configuration defects.

## Research

- RFC 9110 HTTP Semantics: 408, 429 and 5xx are transient by definition, while
  401/403/404/422 are client-correctable — https://www.rfc-editor.org/rfc/rfc9110
- OpenAI API error codes — https://platform.openai.com/docs/guides/error-codes
- Anthropic API errors — https://docs.anthropic.com/en/api/errors

## Risks / Trade-offs

- A provider that reports a transient condition as 400 is classified terminal.
  Accepted: the HTTP status is the contract; providers must not use 400 for
  backpressure.
- Unknown statuses (for example 418) default to terminal because they are not in
  the retryable set. This is explicit in the spec.

## Verification

- `tests/unit/agent-invocation-adapter.test.mjs` — 429 retryable, 403 terminal.
- `openspec validate --changes --strict`.
- `npm run build` followed by the `dist/index.js` load check.
