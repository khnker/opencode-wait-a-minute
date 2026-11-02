# Implement Agent Feedback

## Why

The deterministic pipeline can stop on `REVISION_REQUIRED` or `REPLAN_REQUIRED`,
but it cannot act on the Reviewer's findings. WAM needs a bounded feedback cycle
that turns review findings into a new Builder attempt or a new design, without
letting agents coordinate themselves.

## What Changes

- Adds an `agent-feedback` capability.
- `REVISION_REQUIRED` reruns Builder with review findings as constraints, then
  reruns Reviewer.
- `REPLAN_REQUIRED` reruns Architect, Builder and Reviewer.
- Review findings become constraint lines with severity, corrective action and
  evidence.
- Replan discards superseded decision constraints before the new Architect run.
- Revision and replan counts are bounded and defaults are 2 and 1.
- Exhausted feedback stops with the review verdict and `exhausted: true`.
- Invocation IDs increment per role (`BUILDER:2`, `REVIEWER:2`, ...).

## Impact

- `src/agents/orchestrator.js`: adds `runAgentFeedbackOrchestration` and bounded
  feedback execution.
- `tests/unit/agent-feedback.test.mjs` (new)
- `openspec/changes/implement-agent-feedback/**` (new)

## Non-Goals

- Task Loop integration (Change 06).
- Persisting task state, approvals, evidence or completion.
- Parallel role execution or agent-to-agent calls.
- Unbounded retry until acceptance.
- Automatic acceptance after a retry.
