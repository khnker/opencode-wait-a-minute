# Design: iterate-agent-friction

## Research

- OpenCode plugin and server contracts: session prompts are injected through
  `client.session.prompt({ path: { id }, body: { parts } })`; child sessions
  carry `parentID` and can still be prompted.
  - https://opencode.ai/docs/plugins/
  - https://opencode.ai/docs/server/
- OpenCode agent model: a subagent cannot be used as a primary agent; role
  agents must either run as the session's primary agent or be selected per
  prompt.
  - https://opencode.ai/docs/agents/
- Evaluator-optimizer and orchestrator-workers patterns: a generator and an
  evaluator iterate until the evaluator accepts or the budget is exhausted.
  - https://www.anthropic.com/engineering/building-effective-agents
- Multi-agent debate: independent agents with different context improve
  factuality when their disagreements are fed back into the next round.
  - https://arxiv.org/abs/2305.14325

## Current behavior

- `src/agents/orchestrator.js` (ANALYZE branch) returns
  `finish(verdict, REVIEWER, verdict, { exhausted: true })` on the first
  `REVISION_REQUIRED` / `REPLAN_REQUIRED`, so reviewer friction is recorded but
  never acted on.
- `src/agents/invocation-adapter.js` maps every prompt failure to
  `PROMPT_FAILED`, including client timeouts and aborts; the structured code is
  lost when `applyAgentFailure` stores only a string.
- `src/execution/task-agent-run.js` runs one orchestration attempt; the first
  failure becomes a terminal `FAILED` run.
- `src/execution/task-loop.js` maps `FAILED` to `BLOCK`, which blocks mutations
  and requires user intervention even for a transient timeout.

## Alternatives evaluated

1. **Keep single-pass and BLOCK on failure (current)** — rejected: a transient
   timeout or one reviewer rejection terminates the task and the loop never
   converges on the real findings.
2. **Retry forever until success** — rejected: unbounded cost and
   non-deterministic runtime; violates the bounded-loop design.
3. **Retry with the identical prompt/context** — rejected: the same long
   exploration repeats and hits the same transport timeout.
4. **Chosen: bounded retry with narrowed context + cycle-bounded analysis
   feedback + soft-fail to `WAIT_USER`** — keeps the loop bounded, uses the
   real disagreement as input, and leaves the user in control when the budget
   is exhausted.

## Decisions

### D1. Retryable failures

Add `isRetryableAgentError(error)` in `src/execution/task-agent-run.js`:
retryable for `PROMPT_TIMEOUT`, `PROMPT_FAILED`, `SESSION_CREATE_FAILED` and
orchestration timeouts when the cause is an abort, timeout, 408/429/5xx or a
busy session. Non-retryable: invalid results, contract violations, and role
terminal statuses.

`runTaskAgentStep` accepts `maxAttempts` (default 1 for direct callers, config
default 2) and runs `runAgentFeedbackOrchestration` in a bounded loop. On a
retryable error it increments `attempts`, appends a constraint describing the
previous failure and instructing a minimal evidence-backed result, and reduces
`maxChars` (60% of the previous value, floor 2000) so the next attempt is
narrower. On success it returns the outcome with `attempts`; on exhaustion it
throws the last error with `attempts` and `failureCode`.

### D2. Failure classification

In `src/agents/invocation-adapter.js`, treat `signal.aborted`,
`AbortError`/`ABORT_ERR`, and `TimeoutError` as `PROMPT_TIMEOUT`. Keep the
original cause and status on the error; do not infer timeouts from message text.

`applyAgentFailure` accepts `{ failureCode, attempts }`, persists them on
`agentRun`, and keeps the formatted message.

### D3. Soft-fail

`decideAgentLoopAction({ status: "FAILED", failureCode, attempts })`:
- retryable code with `attempts < maxAttempts` → `CONTINUE`
  (`agent-retryable-failure`) as a safety net;
- otherwise → `WAIT_USER` with `agent-failed: <reason>`.
`BLOCK` remains only for authorization-denied and task-blocked states. The
`decideNextAction` precedence is unchanged.

### D4. ANALYZE iteration

In the ANALYZE branch of `executeOrchestration`, replace the immediate
exhaustion with a bounded loop mirroring the IMPLEMENT feedback loop:

- `REVISION_REQUIRED`: if `cycles.revisions >= maxRevisionCycles`, return the
  verdict with `exhausted: true`; otherwise increment, set
  `accumulated.constraints = [...baseConstraints, ...reviewFindings.map(reviewFindingConstraint)]`,
  rerun ANALYST then ARCHITECT, rerun REVIEWER, and push the revision handoff.
- `REPLAN_REQUIRED`: same pattern, rerunning ARCHITECT then REVIEWER with
  `cycles.replans`.
- `ACCEPTED` → `COMPLETED`; `BLOCKED` → `BLOCKED`; unknown verdicts throw.

This uses the reviewer's real findings (its distinct information context) as
the next iteration's input instead of simulating agreement.

### D5. Config

`DEFAULT_WAM_CONFIG.taskLoop.agents.maxAttempts = 2`; parse
`WAM_AGENT_MAX_ATTEMPTS` and `taskLoop.agents.maxAttempts`. Existing
`maxRevisionCycles` / `maxReplanCycles` keep their current defaults.
