# Tasks

## 1. Failure diagnostics

- [x] 1.1 Add `describeError` and extend `formatAgentFailure` in
      `src/execution/task-agent-run.js` to read provider `data`, `code` and
      `statusCode`/`status` from the error and up to three cause levels.
- [x] 1.2 Keep the existing plain-error and abort-cause output unchanged.

## 2. Stale terminal state

- [x] 2.1 Delete `failureReason` when `reopenTerminalAgentRun` reopens a
      terminal run in `src/execution/agent-run-state.js`.
- [x] 2.2 Keep the history (`results`) and reset `status`, `verdict`,
      `stoppedAt`, `exhausted`, `surfaced` and `cycles`.

## 3. Verification

- [x] 3.1 Add regression tests:
      `formatAgentFailure surfaces HTTP error data from the cause` and
      `reopenTerminalAgentRun` clears a pre-existing `failureReason`.
- [x] 3.2 Run the affected suites
      (`node --test --test-force-exit src/execution/agent-run-state.test.mjs tests/unit/task-agent-loop.test.mjs`),
      `npm run build` and `openspec validate --changes --strict`.
- [x] 3.3 Fresh-session web verification with an isolated fixture: the agent
      loop completed ANALYST → ARCHITECT → BUILDER → REVIEWER, the task reached
      `phase=DONE` with `agentRun.verdict=ACCEPTED`, and no stale
      `agent-failed` block was rendered.
