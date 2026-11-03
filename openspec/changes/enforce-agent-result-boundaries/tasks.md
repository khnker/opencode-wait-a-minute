# Tasks

## 1. Shared result-boundary module

- [x] 1.1 Create `src/agents/result-boundary.js` exporting pure, non-mutating validators.
- [x] 1.2 Implement `validateResultIdentity(result, request)` returning an issues array for `taskId`, `invocationId` and `role` mismatches.
- [x] 1.3 Implement `assertResultIdentity(result, request)` throwing `RoleContractError` with those issues.
- [x] 1.4 Implement `assertInvocationResult({ request, invocation })`: invocation shape check, `assertAgentResult`, identity binding, capability projection; return `{ result, metadata }` unchanged.

## 2. Capability projection

- [x] 2.1 Reject non-empty `decisions` unless `getRoleCapabilities(role).proposeDecisions === true`.
- [x] 2.2 Keep `review` REVIEWER-only.
- [x] 2.3 Document that completion/global-state claims are impossible (schema has no such keys, unknown top-level keys rejected) and assert it with a test.
- [x] 2.4 Confirm `artifacts` / `evidence` are treated as references, not capability claims.

## 3. Orchestrator integration

- [x] 3.1 Call `assertInvocationResult` in `executeOrchestration` immediately after `adapter.invoke`, before any `results.push`, handoff, context accumulation or task decision.
- [x] 3.2 Wrap `RoleContractError` failures in `AgentOrchestrationError` preserving `cause` and role/invocation context.
- [x] 3.3 Verify no partial mutation of `results`, `handoffs`, `findings`, `artifacts`, `evidence`, `constraints` or WAM task state on failure.

## 4. Adapter refactor

- [x] 4.1 Remove the private `assertResultIdentity` from `src/agents/invocation-adapter.js`.
- [x] 4.2 Import `assertResultIdentity` from `src/agents/result-boundary.js` and keep the `AgentInvocationError` / `INVALID_RESULT` fail-fast contract.
- [x] 4.3 Confirm adapter error shape (`code`, `cause`, `sessionID`) is unchanged.

## 5. Tests

- [x] 5.1 Unit tests for `validateResultIdentity` / `assertResultIdentity` (match and each mismatch field).
- [x] 5.2 Unit tests for `assertInvocationResult` (missing result, invalid schema, capability violations, valid passthrough without mutation).
- [x] 5.3 Orchestrator test with a fake adapter that bypasses adapter validation and returns a mismatched identity: expects `AgentOrchestrationError` with `cause`.
- [x] 5.4 Orchestrator test with a fake adapter returning capability-violating results (`decisions` for BUILDER, `review` for non-REVIEWER).
- [x] 5.5 Regression tests proving no partial `results` / `handoffs` / accumulated context / WAM task mutation after a rejected result.
- [x] 5.6 Regression test that a valid result flows through unchanged into `results` and accumulations.
- [x] 5.7 Adapter regression test that `INVALID_RESULT` is still thrown for malformed results.

## 6. Validation

- [x] 6.1 `node --test --test-force-exit <new and changed test files>`.
- [x] 6.2 `openspec validate --changes --strict`.
- [x] 6.3 `npm run build` and load-check `dist/`.
