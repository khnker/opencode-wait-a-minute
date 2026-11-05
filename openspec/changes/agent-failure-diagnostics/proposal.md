# Agent Failure Diagnostics

## Why

When `client.session.prompt` rejects, `formatAgentFailure` only reads
`error.code` and `error.cause.message`. Provider SDKs surface the actionable
detail on `error.data` (`message`, `error.message`, `code`, `statusCode`) or on
`error.status`, so the persisted `agentRun.failureReason` degrades to the
generic `failed to prompt agent session; code=PROMPT_FAILED`. Operators cannot
tell a busy session from an authentication or rate-limit failure, and the loop
block shows the same opaque text.

Separately, `reopenTerminalAgentRun` resets the terminal fields but keeps
`failureReason`. A reopened run therefore still carries the previous failure
text in task summaries and snapshots even though the run is no longer failed.

## What Changes

- Extract a bounded, deterministic description from the error and up to three
  `cause` levels: provider message, error code and HTTP status.
- Emit that detail from `formatAgentFailure` (300-character cap) while
  preserving the existing output for plain errors and abort causes.
- Delete `failureReason` when `reopenTerminalAgentRun` reopens a terminal run.
- Add regression tests for HTTP-shaped causes and for reopening a run that
  carries a stale `failureReason`.

## Impact

- Affected specs: `autonomous-execution-loop`.
- Affected code: `src/execution/task-agent-run.js`,
  `src/execution/agent-run-state.js`.
- Tests: `tests/unit/task-agent-loop.test.mjs`,
  `src/execution/agent-run-state.test.mjs`.
- No configuration, storage format or user-facing command changes.
