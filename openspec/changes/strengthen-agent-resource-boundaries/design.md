# Design: Strengthen Agent Resource Boundaries

## Context

`executeOrchestration` builds a role-scoped request, calls `adapter.invoke`,
then validates the result through `assertInvocationResult`. Structural
validation covers shape, identity and role capabilities, but nothing bounds the
payload, the number of invocations, or how long an adapter may take. Revision
and replan cycles make the invocation count unbounded relative to adapter
behaviour, and a large or stalled result can keep the loop alive indefinitely.

## Research

- OWASP LLM06:2025 — Excessive Agency:
  <https://genai.owasp.org/llmrisk/llm062025-excessive-agency/>. Recommends
  limiting the scope and volume of actions an agent may take and failing closed
  when limits are exceeded.
- NIST AI 600-1 — Generative AI Risk Management Framework:
  <https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence>.
  Frames bounded autonomy, monitoring and graceful failure as governance
  controls rather than optional hardening.
- Node.js `AbortController`:
  <https://nodejs.org/api/globals.html#class-abortcontroller>. Documents
  cooperative cancellation, which the adapter interface does not yet expose;
  this change therefore uses a deadline around the promise instead of aborting
  the adapter.

## Decisions

### D1 — Limits live in one frozen module

`AGENT_RESOURCE_LIMITS` is the single source of defaults. Every consumer reads
the same constants; tests can pass an explicit frozen limit set without mutating
global state. No new dependency is introduced.

### D2 — Byte accounting uses `JSON.stringify` + `Buffer.byteLength`

The result object is already JSON-shaped (the contract only allows JSON
primitives, arrays and objects). Measuring the canonical JSON payload gives a
deterministic, cross-runtime byte count and matches what callers serialize.
`JSON.stringify` failures are reported as a stable contract issue instead of
leaking a raw `TypeError`.

### D3 — Fail loud with `RoleContractError`

Both the byte guard and the collection guards throw `RoleContractError` with
stable issue strings of the form
`result exceeds maxResultBytes (<bytes> > <limit>)` and
`result.<field> exceeds <limitKey> (<count> > <limit>)`.
The orchestrator wraps these into `AgentOrchestrationError` with the original
error as `cause`, matching the existing invalid-result path.

### D4 — Invocation budget is global, deadline is per call

`maxInvocations` bounds the total number of adapter calls across all roles and
cycles, checked before each call so a rejected invocation never reaches the
adapter. `maxInvocationMs` applies to a single `adapter.invoke`. A timeout of
`0` disables the deadline, which keeps existing tests and callers opt-out
capable.

### D5 — Deadline uses `Promise.race` with a cleared timer

The adapter promise is created inside `Promise.resolve().then(...)` so a
synchronous throw still becomes a rejection and the timer is always cleared in
`finally`. `Promise.race` attaches handlers to both promises, so a late adapter
rejection is never left unhandled. The adapter is not aborted: the deadline
rejects the orchestration and reports role and invocation id.

## Alternatives considered

### Rejected — Abort the adapter with `AbortController`

The adapter interface has no signal parameter and third-party adapters would
silently ignore it. Adding one is a larger contract change and would still not
guarantee settlement. The deadline is deterministic today; cooperative
cancellation can be layered on later.

### Rejected — Truncate oversized results

Silently trimming summaries, findings or evidence changes model output and
hides contract violations. The repository rule is deterministic fallbacks and
fail-loud on corrupt or excessive state, so oversized results must be rejected.

### Rejected — Per-role invocation buckets only

Counting per role allows the total to grow with the number of roles and cycles.
A single global budget directly bounds the orchestration loop, which is the
failure mode described in the problem.

## Risks

- Adapters with legitimately large payloads will now fail loud. The default
  `maxResultBytes` is 64 KiB and can be raised per orchestration through
  `resourceLimits`.
- A timed-out adapter keeps running in the background until it settles. This is
  explicitly deferred sandboxing scope; the deadline only protects the
  orchestration loop.
- `JSON.stringify` cost is proportional to result size. Results are rejected
  after one serialization, which is bounded by the same memory they would
  already occupy.
