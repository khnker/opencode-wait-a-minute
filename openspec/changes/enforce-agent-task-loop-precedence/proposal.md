# Change: enforce-agent-task-loop-precedence

## Why

`decideNextAction` in `src/execution/task-loop.js` evaluates `gateComplete` and
the budget/iteration limits before it considers `agentAction` returned by
`decideAgentLoopAction`. When the completion gate is satisfied, a failed,
blocked, needs-input or exhausted agent outcome is silently converted into
`COMPLETE` (reason `evidence-complete`). Reviewer rejection and hard agent stops
can therefore be overridden by stale evidence, hiding unresolved review or
human-input work behind a green gate.

The completion gate must remain authoritative when the agent has nothing
outstanding (an accepted review or no agent run at all), but it must not win
over an agent that is telling the loop it cannot proceed.

## What Changes

1. Introduce an explicit precedence predicate for agent outcomes that must be
   resolved before quality, completion-gate, budget and iteration decisions:
   `BLOCK` (agent `FAILED`), `WAIT_USER` (agent `BLOCKED`, `NEEDS_INPUT`,
   `exhausted`) and reviewer rejections (`CONTINUE`/`REPLAN`).
2. Move that predicate immediately after the authorization/contract/task-blocked
   branches and before `qualityReplans`, `qualityVerifies`, `gateComplete`,
   budget and iteration branches.
3. Keep the accepted-review branch (`VERIFY`) after `gateComplete`; a satisfied
   completion gate still produces `COMPLETE` for accepted or absent agent runs.
4. Add reviewer-rejection mappings to `decideAgentLoopAction` so a non-exhausted
   `REVISION_REQUIRED`/`REPLAN_REQUIRED` outcome is not dropped to `null`:
   `REVISION_REQUIRED` -> `CONTINUE` (`agent-revision-required`) and
   `REPLAN_REQUIRED` -> `REPLAN` (`agent-replan-required`).
5. Cover the precedence matrix with unit tests, including the preserved
   authorization and task-blocked priority.

## Impact

- Affected code: `src/execution/task-loop.js`.
- Affected tests: new `tests/unit/task-loop.test.mjs`, plus a reviewer-rejection
  regression in `tests/unit/task-agent-loop.test.mjs`.
- Behavior change is limited to cases where an agent outcome coexists with a
  satisfied gate, exhausted budget or iteration limit; all previously reachable
  agent-only decisions keep their decision, reason, `nextAction` and checkpoint.
- No configuration, storage or public API change.
