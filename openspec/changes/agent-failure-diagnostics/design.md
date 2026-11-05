# Design — Agent Failure Diagnostics

## Research

- Node.js `Error.cause` and `AggregateError` semantics: the cause chain is the
  documented place for wrapped transport errors.
  https://nodejs.org/api/errors.html#errorcause
- MDN `Error.cause` (portable cause chaining):
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
- opencode v1 SDK error shape: `APIError` carries `data.message`,
  `data.error.message`, `data.code` and `data.statusCode`; aborts use
  `ABORT_ERR`. The adapter already preserves the original error as `cause`
  (`AgentInvocationError`).
- OpenSpec change workflow in this repository (research → alternatives →
  delta spec → implementation).

## Alternatives

1. **Serialize the whole error with `JSON.stringify`.** Rejected: causes can
   cycle, provider bodies can be large or contain request metadata, and the
   output would be unstable across SDK versions.
2. **Only read `error.message`.** Rejected: the HTTP status and provider body
   are exactly the missing detail; a generic wrapper message is what made the
   failure opaque.
3. **Structured extraction up to a fixed depth (chosen).** Read the known
   fields from the error, its `data`, `data.error` and up to three `cause`
   levels; build one deterministic, length-capped line. No unbounded traversal,
   no secrets beyond what the provider already put in the error.

## Decision

- `describeError(error)` returns `{ message, code, status }`, preferring
  `data.error.message`, `data.message`, then `error.message`/`error.name`;
  code from `error.code`, `data.code`, `data.error.code`; status from
  `data.statusCode`, `error.status`, `data.status`.
- `formatAgentFailure` emits `message; code=…; status=…` and then
  `cause: …` / `cause[n]: …` for each cause level, capped at 300 characters.
  The existing plain-error and abort output stays byte-for-byte identical.
- `reopenTerminalAgentRun` builds the fresh run and then deletes
  `failureReason`, so the invariant "failureReason only exists on a FAILED run"
  holds.

## Verification

- Unit tests cover the HTTP-shaped cause, the existing abort cause string and
  the cleared `failureReason`.
- Fresh-session web verification on port 4812 with an isolated fixture:
  a new prompt auto-created the task, the completion gate auto-continued, and
  the agent loop ran `WAM ANALYST` → `WAM ARCHITECT` → `WAM BUILDER` →
  `WAM REVIEWER`; `agentRun.status=COMPLETED`, `verdict=ACCEPTED`,
  `req-1=verified`, `phase=DONE`, with no `failureReason` and no
  `agent-failed` block.
