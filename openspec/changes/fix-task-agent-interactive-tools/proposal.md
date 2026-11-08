# Proposal: Disable interactive tools in task agent passes

## Why

The autonomous task loop blocks with `WAIT_USER` after an agent role invokes the
interactive `question` tool. The invocation then waits for a human answer until
the 300 s timeout, so the role never returns its required JSON result. Observed
in an ANALYST child session:

- `msg_...` finished with `tool-calls` on `question`
- the invocation timed out: `invocation timed out after 300000ms ... ANALYST:1`

A second failure mode is an agent exploring until the same timeout. Both are
caused by role passes having interactive/unbounded tools instead of a bounded
read-only contract.

## What Changes

- Disable the `question` tool in `READ_ONLY_TOOLS` (inherited by `BUILDER_TOOLS`).
- Tell every role prompt not to ask the user; unknowns go in `openQuestions`.
- Regression tests for both.

## Impact

- Affected capability: `agent-invocation`.
- No public API change. Role sessions keep read-only tools and lose the
  interactive question path.
- Users still answer decisions through the WAM loop (`WAIT_USER`), not inside a
  child role session.
