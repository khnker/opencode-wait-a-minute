# Design: Bounded Agent Feedback

## Research

- Anthropic multi-agent research system: the lead agent owns iteration and
  synthesis; workers do not recursively delegate.
  https://www.anthropic.com/engineering/multi-agent-research-system
- OpenCode agents: each invocation is an isolated session with its own prompt and
  tool policy, so feedback is a new invocation rather than state in the agent.
  https://opencode.ai/docs/agents/
- Existing WAM orchestration uses bounded phases and explicit transitions rather
  than open-ended loops (`src/integration/orchestration.js`).

## Alternatives Considered

1. **Retry until the Reviewer accepts.** Rejected: unbounded cost and no
   deterministic stop for WAM.
2. **Let the Reviewer invoke Builder directly.** Rejected: agents would
   coordinate themselves and bypass WAM's limits.
3. **Bounded feedback state machine owned by the orchestrator.** Chosen:
   deterministic, testable and explicit about exhaustion.

## State Machine

```text
ANALYST -> ARCHITECT -> BUILDER -> REVIEWER
                         ^           |
                         | REVISION  |
                         +-----------+
                              |
                         REPLAN
                              v
                         ARCHITECT -> BUILDER -> REVIEWER
```

## Feedback Rules

- `REVISION_REQUIRED`:
  - Requires a remaining revision cycle.
  - Adds Reviewer findings to the constraint window.
  - Reruns `BUILDER` then `REVIEWER`.
- `REPLAN_REQUIRED`:
  - Requires a remaining replan cycle.
  - Rebuilds constraints as base constraints plus the latest Reviewer findings.
  - Reruns `ARCHITECT`, then `BUILDER`, then `REVIEWER`.
  - Old decision and open-question constraints are discarded because the design
    is being replaced.
- `ACCEPTED` returns `COMPLETED` with the accepted verdict.
- `BLOCKED`, `NEEDS_INPUT` and `FAILED` stop immediately.

## Review Finding Handoff

Review findings do not have an `AgentFinding.id`, so they are not placed in
`priorFindings`. They become constraint lines:

```text
Review finding (<severity>[, <criterionId>]): <description> | corrective action: <action> | evidence: <refs>
```

The original review findings are also returned in the feedback handoff for WAM
audit.

## Limits

- Defaults: `maxRevisionCycles = 2`, `maxReplanCycles = 1`.
- Limits are non-negative integers.
- `runAgentOrchestration` keeps zero feedback cycles; it remains the one-pass
  pipeline from Change 04.
- Exhaustion returns the last review verdict, `stoppedAt: "REVIEWER"` and
  `exhausted: true`.
- Invocation IDs increment per role, so retries are auditable.

## Risks

- A revision can still fail; WAM must surface exhaustion rather than claim
  completion.
- Replanning discards old decision constraints but keeps artifacts and evidence;
  WAM must treat old artifacts as potentially stale.
- Review findings are textual constraints, not a structured feedback store; WAM
  must persist the original results for audit.
