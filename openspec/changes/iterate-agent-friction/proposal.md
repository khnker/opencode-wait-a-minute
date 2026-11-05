# Change: iterate-agent-friction

## Why

The autonomous agent pass currently turns the first invocation failure (for
example a prompt timeout or an aborted child session) into a terminal `BLOCK`,
and ANALYZE mode returns `exhausted: true` on the first reviewer rejection. The
role agents deliberately receive different information contexts (analyst,
architect, builder, reviewer), so disagreement and friction between them is
expected; today that friction is either surfaced without acting on it or it
kills the whole task. The loop must iterate on real findings instead of
simulating agreement or blocking.

## What Changes

1. Retry retryable agent-invocation failures inside the agent pass, bounded by
   `taskLoop.agents.maxAttempts`, feeding the previous failure and a narrower
   context to the next attempt.
2. Classify timeout/abort failures as `PROMPT_TIMEOUT` (not `PROMPT_FAILED`) and
   persist structured `failureCode` and `attempts` on the agent run.
3. Map an exhausted agent failure to `WAIT_USER` with an actionable reason;
   `BLOCK` stays reserved for authorization and task-blocked states.
4. Make ANALYZE mode iterate on reviewer friction: `REVISION_REQUIRED` reruns
   ANALYST and ARCHITECT with the review findings as constraints;
   `REPLAN_REQUIRED` reruns ARCHITECT. Both are bounded by
   `maxRevisionCycles` / `maxReplanCycles` and keep the original review
   findings in the handoff.
5. Add `taskLoop.agents.maxAttempts` config (`WAM_AGENT_MAX_ATTEMPTS`, file and
   default 2).

## Non-goals

- Unbounded debate or infinite retries.
- Changing role contracts, prompts, or adding new models/agents.
- Auto-approving contracts, permissions, or authorizations.
- Replacing the completion gate or the deterministic task-loop controller.
