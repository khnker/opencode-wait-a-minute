# Proposal: Enforce agent result boundaries

## Why

`src/agents/orchestrator.js` trusts whatever an adapter returns. After
`adapter.invoke(request)` it only checks `invocation?.result` truthiness, then uses that
result directly: it pushes it into `results`, feeds `handoffs`, and accumulates
`findings`, `artifacts`, `evidence` and `constraints`.

The only result validation lives inside `src/agents/invocation-adapter.js`
(`assertAgentResult` plus a private `assertResultIdentity`). That means:

- A custom adapter, a test double, or an adapter bug can return a result whose `taskId`,
  `invocationId` or `role` do not match the request, and the orchestrator will accept it.
- A result can claim capabilities its role does not hold (for example a BUILDER result
  carrying `decisions`, or a non-REVIEWER result carrying a `review` payload) and those
  claims flow into shared orchestration state.
- A malformed result can leave the orchestrator's accumulated context partially mutated
  before anything notices.

The collaboration boundary — not the transport layer — must be the authority. This is
Change 08 of the multi-agent hardening sequence described in `AGENTS.md` ("validate at
trust boundaries; fail loud on corrupt state").

## What Changes

- Add `src/agents/result-boundary.js`, a shared module of pure validators:
  - `validateResultIdentity(result, request)` returns an issues array.
  - `assertResultIdentity(result, request)` throws `RoleContractError` on mismatch.
  - `assertInvocationResult({ request, invocation })` validates the invocation shape,
    runs `assertAgentResult`, enforces identity binding, and enforces role-capability
    claims, returning `{ result, metadata }` without mutating either.
- Move the identity assertion out of `invocation-adapter.js` into the shared module; the
  adapter imports it and keeps its fail-fast transport validation with
  `AgentInvocationError` / code `INVALID_RESULT`.
- Call `assertInvocationResult` in `orchestrator.js` immediately after `adapter.invoke`,
  before any `results.push`, handoff accumulation, context accumulation or task decision.
  On failure, throw `AgentOrchestrationError` preserving the underlying cause plus role and
  invocation context.
- Enforce capability projection: non-empty `decisions` requires
  `getRoleCapabilities(role).proposeDecisions === true`; `review` remains REVIEWER-only;
  completion and global-state claims stay impossible because the result schema has no such
  keys and unknown top-level keys are rejected.
- Add unit and regression tests, including a fake adapter that bypasses adapter-layer
  validation.

## Impact

- Code: `src/agents/result-boundary.js` (new), `src/agents/orchestrator.js`,
  `src/agents/invocation-adapter.js`.
- Tests: new unit tests for the shared validators and orchestrator regression tests proving
  no partial `results`, `handoffs`, or accumulated context on failure.
- Specs: new capability `agent-result-boundaries` under
  `openspec/changes/enforce-agent-result-boundaries/specs/`.
- Public API unchanged: `runAgentOrchestration` and `runAgentFeedbackOrchestration` keep
  their signatures; only failure behavior for invalid results becomes strict.

## Non-goals

- Reviewing review artifacts or diffs for content quality.
- Validating approved strategy or plan semantics.
- Task-loop precedence or scheduling changes.
- Strong sandboxing, resource limits or process isolation (deferred to Change 12).
- Real-model benchmarking of adapter behavior.
