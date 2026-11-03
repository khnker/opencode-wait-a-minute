# Design: Enforce agent result boundaries

## Problem

`orchestrator.js` treats adapter output as trusted. After `adapter.invoke(request)` it
checks only `invocation?.result` truthiness and then accumulates the value into `results`,
`handoffs`, and the shared `findings` / `artifacts` / `evidence` / `constraints` buckets.
Identity and schema checks exist only inside `invocation-adapter.js`
(`assertAgentResult` + private `assertResultIdentity`), so any adapter that does not run
those checks — a custom adapter, a test double, or a future adapter implementation — can
inject a result bound to a different task, invocation or role.

Role boundaries also leak: `role-contracts.js` exposes a capability matrix
(ANALYST/ARCHITECT/REVIEWER `proposeDecisions: true`, `modifyCode: false`; BUILDER
`proposeDecisions: false`, `modifyCode: true`; all roles `modifyGlobalState: false`,
`approveCompletion: false`), but nothing checks a returned result against it at the
collaboration boundary.

## Research

- OWASP Top 10 for LLM Applications 2025, LLM06:2025 Excessive Agency —
  <https://genai.owasp.org/llmrisk/llm062025-excessive-agency/>. Guidance: grant the
  minimum agency required, validate outputs at the point where they influence downstream
  action, and do not rely on a single layer of control.
- NIST AI Risk Management Framework: Generative AI Profile (NIST AI 600-1) —
  <https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence>.
  Guidance: define trust boundaries explicitly and verify inputs/outputs crossing them.
- Repo rule from `AGENTS.md`: "Validate at trust boundaries; fail loud on corrupt state,
  fail soft on diagnostics."

Both sources point the same way: validation belongs where the output is consumed, not only
where it is produced, and capability claims must be checked against an explicit policy
rather than inferred from payload shape.

## Alternatives considered

1. **Adapter-only validation (status quo).** Rejected. It is a single point of failure:
   any adapter that skips or reimplements validation — custom adapters, test doubles,
   future transports — reopens the hole, and the orchestrator has no way to tell a trusted
   result from an untrusted one.
2. **JSON-schema / Ajv validation of results.** Rejected. It would add a runtime dependency
   to enforce structure that the existing hand-written validators in
   `role-contracts.js` already express, and JSON Schema cannot express the cross-field
   identity binding (`taskId`/`invocationId`/`role` against the request) or capability
   projection cleanly without custom keywords. It also conflicts with the repo's
   "deterministic fallbacks first, dependencies optional" rule.
3. **Orchestrator-only validation.** Rejected. The adapter must still fail fast on
   transport-level corruption so bad results surface close to their source with
   `AgentInvocationError` / `INVALID_RESULT`; moving everything upward would lose that
   locality and the adapter's error contract.
4. **Chosen: shared pure validator at both boundaries.** Extract the identity logic into
   `src/agents/result-boundary.js`, import it from both the adapter and the orchestrator,
   and let each boundary apply the checks appropriate to it. One implementation, no new
   dependencies, and the orchestrator becomes the authoritative collaboration boundary.

## Design

### Shared module: `src/agents/result-boundary.js`

Pure functions, no I/O, no mutation:

- `validateResultIdentity(result, request)` → array of issue objects (empty when valid).
  Compares `result.taskId` with `request.taskId`, `result.invocationId` with
  `request.invocationId`, and `result.role` with `request.role`.
- `assertResultIdentity(result, request)` → throws `RoleContractError` (from
  `role-contracts.js`) populated with the issues when any mismatch is found.
- `assertInvocationResult({ request, invocation })` → validates that the invocation has a
  result, runs `assertAgentResult(result)`, runs `assertResultIdentity(result, request)`,
  then enforces capability projection. Returns `{ result, metadata }` referencing the
  original objects; it never mutates the result or the request.

### Capability projection

- Non-empty `decisions` requires `getRoleCapabilities(role).proposeDecisions === true`.
- `review` remains REVIEWER-only.
- Completion and global-state claims are structurally impossible: the result schema has no
  such keys and unknown top-level keys are already rejected by `assertAgentResult`.
- `artifacts` and `evidence` are references to produced material, not capability claims;
  they are not restricted by the capability matrix.

Violations raise `RoleContractError` with a stable issue describing the role, the claimed
field and the capability that forbids it.

### Adapter

`invocation-adapter.js` keeps its fail-fast transport contract: on invalid invocation or
invalid result it throws `AgentInvocationError` with code `INVALID_RESULT` (preserving
`cause` and `sessionID`). It stops owning the private `assertResultIdentity` and instead
imports `assertResultIdentity` from the shared module, wrapping a `RoleContractError` into
`AgentInvocationError` as it does today.

### Orchestrator

Both `runAgentOrchestration` and `runAgentFeedbackOrchestration` funnel through
`executeOrchestration`, which is where the boundary check is added:

```
const invocation = await adapter.invoke(request);
const { result } = assertInvocationResult({ request, invocation }); // may throw RoleContractError
// ... only now: results.push(result), handoff/context accumulation, task decisions
```

`assertInvocationResult` is called before any mutation of `results`, `handoffs`, or the
accumulated `findings` / `artifacts` / `evidence` / `constraints`. A `RoleContractError` is
caught at the orchestration edge and rethrown as `AgentOrchestrationError` with:

- the underlying error attached as `cause`,
- the offending role and invocation identifiers in the message/context,
- no partial state committed.

Because validation happens before accumulation, an invalid result cannot produce a partial
handoff, cannot alter WAM task state, and cannot influence a subsequent task decision.

### Defense in depth

- Adapter = transport fail-fast, closest to the source of the malformed payload.
- Orchestrator = authoritative collaboration boundary, applied regardless of which adapter
  is in use, including custom adapters and test doubles.

Strong sandboxing and resource limits (CPU, memory, wall-clock, filesystem) are explicitly
out of scope for this change and deferred to Change 12.

## Risks

- Stricter validation may surface previously tolerated adapter sloppiness (wrong
  `invocationId` on resume paths). Mitigation: tests cover the valid path so regressions are
  distinguishable from intended strictness.
- Duplicating checks at two boundaries costs a small amount of work per invocation; results
  are bounded and validation is pure, so the cost is negligible.

## Validation

- `node --test --test-force-exit` on the new/changed test files.
- `openspec validate --changes --strict`.
- `npm run build` and a load-check of `dist/`.
