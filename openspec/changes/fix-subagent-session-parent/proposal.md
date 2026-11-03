# Fix subagent session parent resolution

## Why

Worker sessions created by the agent loop carry a `parentID`, but WAM failed to
read it because `client.session.get` returns `{ data }`. Child sessions were
therefore treated as main sessions: WAM injected task context and auto-loop
continuations, which made the worker answer for a different task and fail the
identity boundary.

## What Changes

- Unwrap the `client.session.get` response before reading `directory` and
  `parentID`.
- Cache the resolved parent so `maybeTaskLoop` skips worker sessions and
  `isSubagentSession` classifies them correctly.
- Cover the wrapped response shape with a regression test.

## Impact

- Affected specs: `agent-session-governance`
- Affected code: `index.js`, `tests/unit/plugin-load.test.mjs`
- No change to the agent loop contract or task phases.
