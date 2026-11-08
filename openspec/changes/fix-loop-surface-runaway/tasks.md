# Tasks: Fix Loop Surface Runaway

## 1. Provenance

- [x] 1.1 Tag `buildTaskLoopPrompt()` parts with `metadata.wam = true`.
- [x] 1.2 Add a test asserting `isWamSynthetic()` recognises the loop part and
      `extractPrompt()` ignores it.

## 2. Sticky surface

- [x] 2.1 Add a terminal-signal identity helper in
      `src/execution/agent-run-state.js`.
- [x] 2.2 Carry `surfaced` forward in `agentSignalForLoop()` for fresh
      outcomes that match the persisted terminal signal.
- [x] 2.3 Preserve `surfaced` in `applyAgentRun()` for the same signal.
- [x] 2.4 Include `repeatedDecision` in the `surfaceByAgent` branch of
      `needsUserSurface` (auth-token aware).

## 3. Failure budget

- [x] 3.1 Track `failureStreak` on `agentRun` (increment on failed runs,
      reset on success).
- [x] 3.2 Reset `failureStreak` in `reopenTerminalAgentRun()`.
- [x] 3.3 Enforce `maxConsecutiveFailures` in `shouldRunTaskAgentPass()`.
- [x] 3.4 Add `taskLoop.agents.maxConsecutiveFailures` (default 3) to
      `wam-config` and pass it from `index.js`.

## 4. Verification

- [x] 4.1 Add regression tests for repeated failed passes without duplicate
      prompts and for the failure budget.
- [x] 4.2 Run `node --test --test-force-exit` on the affected suites.
- [x] 4.3 Run `openspec validate --changes --strict`.
- [x] 4.4 Run `npm run build` and load-check `dist/`.
- [x] 4.5 Run `npm run verify:web -- --out <tmp>` in a fresh session.
