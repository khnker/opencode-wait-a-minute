# Proposal: Strengthen Agent Resource Boundaries

## Problem

Agent results and invocations are structurally validated but not
resource-bounded. The orchestrator trusts that an adapter returns a result of
reasonable size, that collections stay small, that the pipeline cannot invoke
agents forever, and that an adapter call eventually settles. A single oversized
result, an excessive collection, a runaway invocation count, or a hanging
adapter can exhaust the orchestration loop and the caller's memory budget.

The existing `assertAgentResult` validates shape, identity and capabilities,
but a structurally valid result can still carry megabytes of text or thousands
of findings. Revision and replan cycles can multiply invocations without any
upper bound, and `adapter.invoke` has no deadline.

## Changes

- Add `src/agents/resource-policy.js` with frozen default limits
  (`AGENT_RESOURCE_LIMITS`), an override resolver (`resolveResourceLimits`) and
  a deterministic result guard (`assertResultResources`).
- Run `assertResultResources` from `assertInvocationResult` after the structural
  result contract and before identity/capability checks.
- Accept optional `resourceLimits` in orchestration options, validated through
  `resolveResourceLimits`.
- Enforce a total invocation budget (`maxInvocations`) before every adapter
  call and fail loud with `AgentOrchestrationError`.
- Enforce an optional per-invocation deadline (`maxInvocationMs`) around
  `adapter.invoke` using `Promise.race` and a cleared `setTimeout`. A value of
  `0` disables the deadline.
- Cover limits resolution, byte/collection rejection, invocation budgets,
  timeouts and unchanged valid flows with unit tests.

## Non-goals

- Full sandboxing, process isolation or OS-level resource enforcement. Those
  remain deferred; this change only adds deterministic soft limits in-process.
- Killing or aborting an in-flight adapter. The deadline rejects the
  orchestration promise; cooperative cancellation is future work.
- Streaming or truncating oversized results. Oversized results fail loud
  instead of being silently trimmed.

## Impact

- Affected code: `src/agents/resource-policy.js` (new),
  `src/agents/result-boundary.js`, `src/agents/orchestrator.js`.
- Affected tests: `tests/unit/agent-resource-policy.test.mjs` (new), plus
  extensions to `tests/unit/agent-result-boundary.test.mjs` and
  `tests/unit/agent-orchestrator.test.mjs`.
- Public API: additive. `assertInvocationResult` gains an optional
  `resourceLimits`; orchestration options gain an optional `resourceLimits`.
  Existing callers keep the defaults and existing valid results are unchanged.
