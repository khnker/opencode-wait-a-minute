# Proposal: Fix Loop Surface Runaway

## Why

A real session (`ses_e58d835c5ffe1lwzlWAvrfSYBL`) ran for ~21 hours and grew
`opencode.db` to 58.5 GB. Forensics on the persisted state and the OpenCode
log show a self-sustaining loop with these exact counters:

- 7,307 `driveTaskLoop` decisions (all `WAIT_USER`).
- 14,638 child sessions titled `WAM ANALYST …:ANALYST:1` (two per pass,
  because `maxAttempts: 2` creates a child session per attempt).
- 15,757 parent messages (one synthetic loop prompt + one aborted assistant
  answer per decision).
- `agentRun.failureCode: "PROMPT_FAILED"`, `attempts: 2`, `surfaced: false`
  re-written every ~0.7 s; `executionGate` opened and closed in ~75 ms.

Root cause chain:

1. `buildTaskLoopPrompt()` emits `{ type: "text", synthetic: true }` but does
   **not** set `metadata.wam`. `extractPrompt()` in the `chat.message` hook
   only rejects parts tagged via `isWamSynthetic()` (metadata marker), so each
   synthetic loop prompt is treated as fresh user input.
2. That synthetic user message calls `reopenTerminalAgentRun()`, which resets
   `agentRun.status/surfaced`. The very next agent pass fails again and
   `driveTaskLoop` sees an unsurfaced terminal signal.
3. `applyAgentRun()` rebuilds `agentRun` from scratch and drops `surfaced`,
   so even without the re-open the marker does not survive the next pass.
4. `needsUserSurface` bypasses the `repeatedDecision` guard whenever
   `surfaceByAgent` is true, so repeated identical `WAIT_USER` decisions keep
   prompting the parent.
5. `shouldRunTaskAgentPass()` always allows `FAILED` retries and there is no
   consecutive-failure budget, so each idle event creates another child
   session / two attempts.

The result is an unbounded prompt → idle → agent-pass → surface cycle.

## What Changes

- Tag task-loop prompts with the WAM provenance marker so the chat hook never
  mistakes them for user input (no `reopenTerminalAgentRun`, no task rebuild).
- Preserve the `surfaced` marker when the next agent run has the same terminal
  signal (`status` + `verdict` + `exhausted` + `failureCode`).
- Add a consecutive-failure streak to `agentRun` and refuse further agent
  passes once `taskLoop.agents.maxConsecutiveFailures` is reached, until a real
  user message reopens the run.
- Include `repeatedDecision` in the `surfaceByAgent` branch of
  `driveTaskLoop` as a second, loop-state-level guard (except for a new
  authorization token).

## Capabilities

### Modified Capabilities

- `autonomous-execution-loop`: synthetic loop prompts are provenance-tagged,
  terminal surfaces are idempotent across agent passes, and repeated agent
  failures are bounded.

## Impact

- `src/execution/task-loop.js` — provenance marker on `buildTaskLoopPrompt`.
- `src/execution/agent-run-state.js` — terminal-signal identity helper and
  surfaced carry-over.
- `src/execution/task-agent-run.js` — `applyAgentRun` preserves `surfaced`
  and tracks `failureStreak`; `shouldRunTaskAgentPass` enforces the budget.
- `src/adapters/opencode-v1/session-driver.js` — repeated-decision guard.
- `src/config/wam-config.js` — `taskLoop.agents.maxConsecutiveFailures`
  (default 3).
- `index.js` — pass the configured failure budget to the pass gate.
- Tests: `src/execution/task-loop.test.mjs`,
  `src/execution/agent-run-state.test.mjs`,
  `tests/unit/task-agent-loop.test.mjs`,
  `src/adapters/opencode-v1/session-driver.test.mjs`.

No database migration is required. The cleanup already removed the runaway
subtree; this change prevents a recurrence.
