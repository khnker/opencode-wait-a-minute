# Orchestrate Agent Roles

## Why

Changes 01-03 provide contracts, invocation and bounded context, but WAM still
has no deterministic sequence that hands work from Analyst to Architect to
Builder to Reviewer. Without that sequence each role would need to know what to
do next, which would make agents coordinate themselves.

## What Changes

- Adds an `agent-orchestration` capability with one deterministic pipeline.
- Runs `ANALYST -> ARCHITECT -> BUILDER -> REVIEWER` once, with no retries.
- Builds each role request from the task objective, acceptance criteria and
  context selected from prior results.
- Hands Analyst findings to later roles, Architect decisions as constraints and
  Builder artifacts/evidence to the Reviewer.
- Stops on `BLOCKED`, `NEEDS_INPUT`, `FAILED` or a Reviewer verdict that requires
  revision/replan.
- Returns results and metadata; WAM remains the only writer of task state.

## Impact

- `src/agents/orchestrator.js` (new)
- `tests/unit/agent-orchestrator.test.mjs` (new)
- `openspec/changes/orchestrate-agent-roles/**` (new)
- No Task Loop or completion-gate integration.

## Non-Goals

- Review feedback cycles or automatic replanning (Change 05).
- Task Loop integration (Change 06).
- Multi-agent benchmarking (Change 07).
- Parallel role execution.
- Agents invoking each other.
- Persisting task state, approvals, evidence or completion from the orchestrator.
