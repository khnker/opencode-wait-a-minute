# Design: Agent Role Orchestration

## Research

- Anthropic multi-agent research system: a lead agent decomposes work, delegates
  to isolated workers and owns the final synthesis.
  https://www.anthropic.com/engineering/multi-agent-research-system
- OpenCode agents: each invocation can select an agent, system prompt and tool
  policy; the host does not decide the multi-role sequence.
  https://opencode.ai/docs/agents/
- Existing WAM orchestration uses deterministic phases and explicit state
  transitions rather than a model-selected next step (`src/integration/orchestration.js`).

## Alternatives Considered

1. **Let each agent choose the next role.** Rejected: agents would coordinate
   themselves and could bypass WAM's sequence and limits.
2. **Ask a model planner to choose the sequence.** Rejected for the initial
   pipeline: nondeterministic, harder to test and unnecessary for four fixed
   roles.
3. **Fixed state machine with explicit handoffs.** Chosen: deterministic order,
   one invocation per role, stop conditions owned by WAM.

## Pipeline

```text
ANALYST -> ARCHITECT -> BUILDER -> REVIEWER
```

The pipeline runs once. There are no retries, no parallel branches and no
role-to-role calls. The orchestrator does not load or save task state.

## Handoff Model

Each role request contains:

- The task objective prefixed with a role instruction.
- The task acceptance criteria.
- Role-specific `expectedOutput`.
- Context selected by Change 03 from accumulated sources.

Accumulation rules:

- Findings from completed roles become `priorFindings`.
- Decisions from completed roles become constraint lines:
  `Decision <id>: <description> (<rationale>)`.
- Open questions become constraint lines: `Open question: <text>`.
- Artifacts and evidence refs are appended for later roles.
- The Change 03 policy filters findings and bounds every source.

The Reviewer therefore receives all findings, prior decisions, Builder
artifacts/evidence and a bounded constraint window.

## Stop Conditions

The pipeline stops immediately when a result is `BLOCKED`, `NEEDS_INPUT` or
`FAILED`. A Reviewer `COMPLETED` result stops with `ACCEPTED`,
`REVISION_REQUIRED` or `REPLAN_REQUIRED`. Revision and replan are terminal for
this change; Change 05 owns the feedback cycle.

## Return Value

```text
{
  taskId,
  status,
  verdict,
  stoppedAt,
  results: [{ role, invocationId, result, metadata }],
  handoffs: [{ from, to, findings, decisions, artifacts, evidence }],
  context: [{ role, metadata }]
}
```

`status` is an agent status or a review verdict. `COMPLETED` plus `ACCEPTED`
still does not complete the task; WAM's completion gate keeps that authority.

## Limits

- Exactly four role invocations maximum.
- One invocation ID per role: `<taskId>:<ROLE>:1`.
- No agent may invoke another role; the adapter keeps `task` disabled.
- The orchestrator never writes task state, approvals, evidence or completion.

## Risks

- Decisions encoded as constraint lines are textual handoffs, not a structured
  decision store. WAM must persist the original results for audit.
- Summaries are returned in `results` but are not injected into later prompts;
  later roles consume findings, decisions, artifacts and evidence refs.
- Sequential execution is slower than parallel roles; the fixed dependency chain
  justifies it for now.
