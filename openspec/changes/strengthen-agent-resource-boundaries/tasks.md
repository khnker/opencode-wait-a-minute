# Tasks: Strengthen Agent Resource Boundaries

## 1. Resource policy

- [x] Add `src/agents/resource-policy.js` with frozen `AGENT_RESOURCE_LIMITS`.
- [x] Implement `resolveResourceLimits(overrides)` validating positive integers
  and a non-negative `maxInvocationMs`, returning frozen merged limits.
- [x] Implement `assertResultResources(result, limits)` rejecting results that
  exceed JSON byte size or findings/decisions/artifacts/evidence counts with
  stable `RoleContractError` issues.

## 2. Integration

- [x] Call `assertResultResources` from `assertInvocationResult` after
  `assertAgentResult` and before identity/capability validation.
- [x] Accept optional `resourceLimits` in orchestration options and resolve it
  through `resolveResourceLimits`, wrapping invalid input in
  `AgentOrchestrationError`.
- [x] Enforce `maxInvocations` before each adapter call with role and
  invocation context.
- [x] Enforce `maxInvocationMs` around `adapter.invoke` with
  `Promise.race` + `setTimeout`, clearing the timer in `finally`; `0` disables
  the deadline.

## 3. Tests

- [x] Add `tests/unit/agent-resource-policy.test.mjs` covering defaults,
  overrides, invalid limits, oversized JSON, collection limits and valid
  pass-through.
- [x] Extend `tests/unit/agent-result-boundary.test.mjs` with oversized-result
  rejection and custom-limit coverage.
- [x] Extend `tests/unit/agent-orchestrator.test.mjs` with oversized-result
  cause, invocation-count limit, timeout rejection, invalid limits and an
  unchanged valid flow.

## 4. Validation

- [x] Run
  `node --test --test-force-exit tests/unit/agent-resource-policy.test.mjs tests/unit/agent-result-boundary.test.mjs tests/unit/agent-orchestrator.test.mjs tests/unit/agent-role-contracts.test.mjs`.
- [x] Run `npm run build`.
- [x] Run `openspec validate --changes --strict`.
