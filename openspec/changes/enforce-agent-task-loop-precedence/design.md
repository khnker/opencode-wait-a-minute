# Design: enforce-agent-task-loop-precedence

## Context

`decideNextAction` is the pure, deterministic controller for the execution loop.
It combines several independent signals: task state, authorization/contract
state, quality findings, the completion gate, budget and iteration limits, agent
outcomes, progress and pending verification. The order of those checks is the
policy. Today `gateComplete` (and budget/iteration) sit before `agentAction`, so
the controller can answer `COMPLETE` while the agent reports `FAILED`,
`BLOCKED`, `NEEDS_INPUT` or an exhausted review/replan cycle. Reviewer
rejections (`REVISION_REQUIRED`/`REPLAN_REQUIRED`) were also not represented in
`decideAgentLoopAction`, so they fell through to lower-priority branches and
could be masked by a satisfied gate.

### Research

- NIST AI Risk Management Framework — Generative AI Profile:
  https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
  (human oversight and fail-loud handling of unreliable automated outcomes).
- OWASP LLM06:2025 Excessive Agency:
  https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
  (an automated actor must not be able to mark work complete when the
  responsible reviewer/pipeline says otherwise).
- Google Engineering Practices — What to look for in a code review:
  https://google.github.io/eng-practices/review/reviewer/looking-for.html
  (a reviewer rejection is blocking until addressed; completion must not be
  inferred from unrelated passing signals).

These sources converge on the same rule: an explicit negative outcome from a
responsible actor outranks a passive success signal. Applied here, agent hard
stops and reviewer rejections outrank `gateComplete`; the gate still decides
completion when there is no outstanding agent obligation.

## Goals

- Make the precedence self-documenting and centrally testable.
- Ensure reviewer rejection and hard agent stops cannot be overridden by a
  satisfied completion gate, quality findings, budget exhaustion or iteration
  limits.
- Preserve authorization/contract/task-blocked priority.
- Preserve the completion gate as authoritative for accepted reviews and for
  loops without an agent.
- Preserve every existing decision, reason, `nextAction` and checkpoint shape.

## Non-Goals

- Changing how the completion gate or the agent orchestrator compute their
  signals.
- Adding retries, timers or new loop states.
- Changing `TASK_LOOP_DECISIONS` or `ACTIONABLE`.

## Decisions

### Decision 1: Explicit pre-gate predicate

Add `AGENT_PRE_GATE_DECISIONS = {BLOCK, WAIT_USER, CONTINUE, REPLAN}` and
`isAgentPreGateAction(action)`. The predicate is evaluated immediately after
`task-blocked` and before `qualityReplans`/`gateComplete`/budget/iteration.

Why: the set documents exactly which agent outcomes are allowed to preempt the
gate. It keeps the branch chain readable and prevents a future decision from
accidentally being treated as pre-gate.

`ACCEPTED` maps to `VERIFY` and is deliberately absent from the set. The existing
`else if (agentAction)` branch remains after `gateComplete`, budget and iteration,
so an accepted review still yields `COMPLETE`/`evidence-complete` when the gate is
satisfied, and `STOP_BUDGET` when the budget is exhausted (existing behavior).

### Decision 2: Represent reviewer rejection in `decideAgentLoopAction`

Non-exhausted `REVISION_REQUIRED` and `REPLAN_REQUIRED` previously returned
`null`. That made reviewer rejection invisible to the precedence rule and let a
satisfied gate produce `COMPLETE`. The function now returns:

- `status === "REVISION_REQUIRED"` -> `{ decision: "CONTINUE", reason: "agent-revision-required" }`
- `status === "REPLAN_REQUIRED"` -> `{ decision: "REPLAN", reason: "agent-replan-required" }`

The existing `exhausted === true` check stays first, so exhausted cycles still
return `WAIT_USER` (`agent-revision-exhausted`/`agent-replan-exhausted`). This is
the only semantic addition to `decideAgentLoopAction`, and it is required to
satisfy "reviewer rejection outranks evidence-complete".

### Decision 3: Keep authorization/contract/task-blocked first

Those branches encode external constraints (denied authorization, pending
approval, unapproved contract, blocked task). An agent outcome cannot override
them, so they stay ahead of the new predicate.

## Alternatives Considered

### Alternative A: Leave precedence unchanged and rely on the reviewer to gate

Rejected. It is exactly the reported bug: a satisfied completion gate produces
`COMPLETE` while the agent reports failure, blockage or rejection. It also makes
the reviewer's negative outcome advisory only.

### Alternative B: Give agent actions absolute priority (before authorization and task-blocked)

Rejected. Authorization denial, pending approval, an unapproved contract and a
blocked task are external safety/contract stops. Letting an agent outcome preempt
them could report `WAIT_USER` or `CONTINUE` where the loop must actually block or
wait for authorization.

### Alternative C: Numeric priority weights per signal

Rejected. A weight table adds configuration and indirection without improving
determinism; the precedence is a policy ordering, and an ordered branch chain
with one named predicate is easier to audit and test.

### Alternative D: Derive completion only from agent `ACCEPTED`

Rejected. The completion gate must remain authoritative for sessions without an
agent and for flows where an accepted review still has to satisfy the gate. It
also keeps existing `gateComplete` behavior (including `COMPLETE` with no agent)
intact.

## Risks and Mitigations

- Risk: a reviewer rejection now preempts budget exhaustion. Mitigation: this is
  a new reachable case (previously rejection was `null`); budget still wins over
  accepted reviews, covered by an explicit regression test.
- Risk: new `decideAgentLoopAction` mappings change reason strings in some
  integration flows. Mitigation: the mapping only applies to non-exhausted
  `REVISION_REQUIRED`/`REPLAN_REQUIRED`, where the previous action was `null`;
  exhausted behavior is untouched and covered by existing tests.
- Risk: future agent decisions accidentally preempt the gate. Mitigation: the
  decision set is explicit and the ACCEPTED case is tested.
