# Change: Recover terminal agent and authorization pauses

## Why

A real session parked forever after the agent orchestrator exhausted its
revision budget. The loop decided `WAIT_USER` (`agent-revision-exhausted`) but
the host adapter treats only `CONTINUE|REPLAN|VERIFY` as actionable, so it
returned without prompting. On every later `session.idle` the fallback replayed
the same terminal `agentRun`, produced the same `WAIT_USER`, and stayed silent.
The user never saw the reviewer findings that were blocking `req-1`, and the
agent pass could not run again because `shouldRunTaskAgentPass` returns `false`
for `exhausted: true`.

The same class of bug affects the other terminal pauses:

- `WAIT_AUTHORIZATION` never prompted, so a pending permission was invisible.
- `BLOCK` (for example `agent-failed`) never prompted, so a failed pass was
  silent.
- `BLOCKED`, `NEEDS_INPUT` and `FAILED` runs were surfaced once but a later real
  user message did not reopen them, so the pass could not retry.

## What changes

- Surface a `WAIT_USER`, `WAIT_AUTHORIZATION`, `BLOCK`, `STOP_BUDGET` or
  `STOP_STAGNATION` decision exactly once per wait episode. `WAIT_USER`
  includes the reviewer findings and pending verification items;
  `WAIT_AUTHORIZATION` includes the pending authorization id; `BLOCK` includes
  the reason; stops include the stop reason.
- Ignore a stale pending authorization when the contract is already approved so
  approving the plan does not add another gate.
- Feed the loop an explicit `needs-user` marker for an
  `exhausted`/`BLOCKED`/`NEEDS_INPUT`/`FAILED` run instead of a stale outcome
  that looks like a fresh agent result.
- Reopen any terminal agent run when a real (non-synthetic) user message
  arrives: clear `status`, `verdict`, `stoppedAt`, `exhausted` and `surfaced`,
  reset the revision cycles so the pass can run again, and clear
  `authorizationSurfacedId` so a still-pending authorization is surfaced again.
- Deduplicate agent-derived pauses with the persisted `agentRun.surfaced` flag,
  authorization pauses with `authorizationSurfacedId`, and stop/contract
  pauses with the loop's `lastDecision` (repeated stops count as one pause).

## Impact

- `src/execution/task-loop.js`, `src/adapters/opencode-v1/session-driver.js`,
  `src/execution/agent-run-state.js` (new), `src/integration/message-handler.js`,
  `index.js`.
- No change to the default `taskLoop` configuration or to synthetic prompts.
- Bounded: surfacing is deduplicated by `agentRun.surfaced` for agent-derived
  pauses, by `authorizationSurfacedId` for authorization waits, and by the
  `lastDecision` transition for contract/block/stop waits.
