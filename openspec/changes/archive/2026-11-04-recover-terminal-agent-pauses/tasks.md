# Tasks — recover terminal agent and authorization pauses

## 1. Implementation

- [x] 1.1 Add `agentSignalForLoop`, `isTerminalAgentSignal` and
      `reopenTerminalAgentRun` in `src/execution/agent-run-state.js`.
- [x] 1.2 Enrich the `WAIT_USER` next action with the pending items and the
      latest reviewer findings, and render them in `buildTaskLoopPrompt`.
- [x] 1.3 Render the pending authorization id, the block reason and the stop
      reason with a next step in `buildTaskLoopPrompt`.
- [x] 1.4 Surface `WAIT_USER`, `WAIT_AUTHORIZATION`, `BLOCK`, `STOP_BUDGET` and
      `STOP_STAGNATION` once in `session-driver.js` (agent-derived pauses keyed
      by `agentRun.surfaced`, authorization by `authorizationSurfacedId`, and
      repeated stops as a single pause).
- [x] 1.5 Use `agentSignalForLoop` instead of replaying `task.agentRun` in
      `runTaskAgentPass`.
- [x] 1.6 Reopen any terminal run (`exhausted`, `BLOCKED`, `NEEDS_INPUT`,
      `FAILED`) on a real user message in `message-handler.js` and persist it
      before the continuation fast-path.
- [x] 1.7 Ignore a pending authorization when the contract is already approved
      so the loop does not add friction after plan approval.
- [x] 1.8 Clear `authorizationSurfacedId` on a real user message so a
      still-pending authorization can be surfaced again.

## 2. Tests

- [x] 2.1 `agentSignalForLoop` returns the fresh outcome, a marker for terminal
      runs, and `null` for stale accepted runs.
- [x] 2.2 `isTerminalAgentSignal` detects exhausted and needs-user runs.
- [x] 2.3 `reopenTerminalAgentRun` clears the terminal fields and revision
      cycles for exhausted/blocked/needs-input/failed runs, and is a no-op for
      healthy or accepted runs.
- [x] 2.4 `buildTaskLoopPrompt` includes reviewer findings and pending items
      for `WAIT_USER`, the authorization id for `WAIT_AUTHORIZATION`, the
      reason for `BLOCK`, and the stop reason for `STOP_BUDGET`/`STOP_STAGNATION`.
- [x] 2.5 `driveTaskLoop` prompts once for an exhausted `WAIT_USER`, persists
      `surfaced`, and stays silent on the next idle.
- [x] 2.6 `driveTaskLoop` prompts once for `WAIT_AUTHORIZATION` (persisting
      `authorizationSurfacedId`) and for a failed agent `BLOCK`, and stays
      silent while the pause does not change.
- [x] 2.7 `driveTaskLoop` prompts on the transition into a non-agent
      `WAIT_USER` and stays silent while the decision does not change.
- [x] 2.8 `handleMessage` reopens exhausted, blocked, needs-input and failed
      runs on real user text and clears `authorizationSurfacedId`, but does not
      on a synthetic loop prompt.
- [x] 2.9 `driveTaskLoop` with an approved contract ignores a stale pending
      authorization and keeps executing.
- [x] 2.10 `driveTaskLoop` surfaces `STOP_BUDGET`/`STOP_STAGNATION` once and
      treats a repeated stop as the same pause.
- [x] 2.11 `resetAuthorizationSurface` clears the marker and is a no-op when
      already clear.

## 3. Validation

- [x] 3.1 `node --test --test-force-exit <affected files>`
- [x] 3.2 `openspec validate --changes --strict`
- [x] 3.3 `npm run build` and load-check `dist/`
