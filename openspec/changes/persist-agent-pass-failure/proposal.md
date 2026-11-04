# Persist failed agent passes

## Problem

When `runTaskAgentPass` throws (adapter error, aborted child session, timeout), the
catch block only logs a warning and returns `agent: null`. Because logging is opt-in
and disabled by default, the failure is invisible: `agentRun` keeps its previous
(non-terminal) state, `shouldRunTaskAgentPass` keeps returning true, and the task loop
retries the same pass on every idle turn. The gate is cleared in `finally`, so the only
durable trace is a gate that briefly went active and inactive.

This is the remaining half of the "the loop should have run but nothing happened"
complaint: the pass did run, failed, and left no state change.

## Change

- Add `applyAgentFailure(task, message)` to persist `agentRun.status = "FAILED"` plus
  `failureReason` (and one history entry).
- In `runTaskAgentPass`, persist that failure in the catch path and return the resulting
  agent signal instead of `agent: null`.
- Include `failureReason` in the loop signal and render it in the `BLOCK` decision
  reason, so the surfaced pause says why the pass failed.

## Impact

- A failing pass becomes terminal: no automatic retry until a real user turn reopens it.
- The existing terminal-pause surfacing (recover-terminal-agent-pauses) shows it once.
- `reopenTerminalAgentRun` already clears `FAILED` on a real user message.
