# Design — recover terminal agent and authorization pauses

## Research

- OpenCode plugin lifecycle: `chat.message` runs for real user input and
  `session.idle` runs after a turn finishes; synthetic parts can be detected by
  provenance. https://opencode.ai/docs/plugins/
- Existing WAM behavior established by `start-agent-loop-early`: an
  accepted/exhausted run must not re-run the agent pass;
  `shouldRunTaskAgentPass` returns `false` for those runs
  (`openspec/changes/start-agent-loop-early/design.md`).
- Node's built-in test runner for regression coverage.
  https://nodejs.org/api/test.html

## Alternatives

1. **Drop the stale agent signal and let the loop decide `CONTINUE`.**
   Rejected: the reviewer rejected the work, but the agent pass cannot re-run
   until the budget is reset. Continuing without the reviewer hides the
   blocking findings from the user and can loop until `STOP_STAGNATION`.
2. **Keep the silent `WAIT_USER`/`WAIT_AUTHORIZATION`/`BLOCK` (current behavior).**
   Rejected: this is the observed bug. The loop parks with pending
   requirements, permissions or failures and no user-visible reason.
3. **Surface every terminal decision on every `session.idle`.**
   Rejected: the host would inject the same synthetic prompt on every idle,
   re-entering the turn and burning the session budget.
4. **Chosen: surface once per wait episode and reopen on a real user turn.**
   The loop keeps its terminal decision (no false progress), but the first
   terminal pause emits one synthetic prompt with the actionable context. A
   later real user message clears the terminal agent run and the revision
   budget, so the next pass can run with the new input.

## Decisions

- `agentSignalForLoop(outcome, task)` returns the fresh outcome when the pass
  ran; otherwise it returns a minimal `needs-user` marker only for
  `exhausted`/`BLOCKED`/`NEEDS_INPUT`/`FAILED` runs, and `null` for stale
  accepted runs. This prevents a stale success from masking progress while
  preserving the explicit wait signal.
- `isTerminalAgentSignal(agent)` centralizes the marker test so the adapter and
  the loop agree on which pauses are agent-derived.
- Deduplication uses independent keys:
  - agent-derived pauses (`WAIT_USER` exhausted/blocked/needs-input and `BLOCK`
    caused by `FAILED`): `agentRun.surfaced === true` (persisted before
    prompting). A user turn resets the flag, so a failed retry is surfaced
    again.
  - `WAIT_AUTHORIZATION`: `authorizationSurfacedId` (persisted before prompting),
    so a real user turn that clears it can surface the still-pending
    authorization again.
  - contract-not-approved `WAIT_USER`, task-level `BLOCK` without a terminal
    agent run and `STOP_BUDGET`/`STOP_STAGNATION`: the loop transition
    `lastDecision !== decision`; any stop following a stop counts as the same
    pause so a budget stop does not resurface as a stagnation stop.
- A pending authorization is ignored when the contract is already `APPROVED`.
  Approval is the authorization the user asked for; keeping the stale gate
  would add friction after the plan is approved.
- `buildTaskLoopPrompt` renders the pending authorization id, the block reason
  and the stop reason with a concrete next step, so the synthetic prompt is
  actionable instead of printing the raw decision name.
- `resetAuthorizationSurface(state)` clears `authorizationSurfacedId` (and
  reports whether it changed), mirroring `reopenTerminalAgentRun` so a real
  user turn re-arms both markers.
- `reopenTerminalAgentRun(state)` mutates the loaded state in place, clearing
  `status`, `verdict`, `stoppedAt`, `exhausted`, `surfaced` and resetting
  `cycles` to zero. Clearing `status` is required because
  `shouldRunTaskAgentPass` refuses to run `BLOCKED`/`NEEDS_INPUT`/`FAILED`
  runs. The handler persists it before the continuation fast-path so early
  returns cannot lose the reset.
- Synthetic prompts remain non-actionable: `extractPrompt` filters synthetic
  parts, so the reset only happens for real user text.

## Risks

- Persisting `surfaced` before the prompt could suppress a retry if the prompt
  call fails. The adapter returns `prompted: false` in that case; the next
  `session.idle` still re-decides and can surface again once the flag is not
  set. To keep that property, `surfaced` is only persisted after the prompt
  function is confirmed available and immediately before dispatch.
- Clearing `status`/`verdict` hides the previous terminal state from consumers
  that only read `agentRun`; the previous outcome remains in `agentHistory` and
  `agentRun.results` for audit.
- Re-arming `authorizationSurfacedId` on any real user text can repeat the
  authorization prompt if the user replies without approving or denying. This
  is intentional: the pending gate is still unresolved, so silence would strand
  the loop. The user can act through `/wam permissions approve|deny`.
- Surfacing stops adds prompts that end the loop, but a stop that follows any
  stop is treated as the same pause so it is not repeated.
- A stale pending authorization under an approved contract is ignored; callers
  that relied on that prompt as a reminder must use the contract approval flow
  instead.
