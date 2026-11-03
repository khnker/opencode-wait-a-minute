# Design: Formalize the Approved Agent Strategy

## Context

The agent pipeline is ANALYST → ARCHITECT → BUILDER → REVIEWER. `invokeRole`
builds every request from a role-scoped context selection, then appends role
specific inputs (for example `reviewArtifacts` for REVIEWER). Decisions and
open questions are accumulated as free-text constraints inside
`accumulated.constraints`.

The missing piece is an explicit, validated handoff object that says: "this is
the strategy ARCHITECT approved, and the orchestrator is authorizing BUILDER to
implement exactly it."

## Research

- NIST AI RMF Generative AI Profile — calls for explicit accountability,
  documented decision provenance, and validation at trust boundaries:
  https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- Google engineering practices — reviewers and implementers should work from a
  shared, unambiguous description of the intended change:
  https://google.github.io/eng-practices/review/reviewer/looking-for.html
- OWASP Top 10 for LLM Applications, LLM06:2025 Excessive Agency — an agent
  should not act beyond explicitly approved scope, and approvals must be
  verifiable rather than implicit:
  https://genai.owasp.org/llmrisk/llm062025-excessive-agency/

## Decisions

### D1 — Frozen, deterministic value object

`buildApprovedStrategy({ decisions, constraints })` returns:

```js
{
  version: 1,
  source: "ARCHITECT",
  approvedBy: "ORCHESTRATOR",
  decisions: [{ id, description, rationale }],
  constraints: [string],
}
```

The object and its nested arrays/decisions are `Object.freeze`d. There are no
timestamps, random ids, or environment reads, so the same inputs produce
byte-identical JSON. This keeps tests and replay deterministic.

### D2 — Validation throws `RoleContractError`

`assertApprovedStrategy` rejects unknown keys, wrong `version`/`source`/
`approvedBy`, non-array `decisions`/`constraints`, malformed decision fields,
duplicate decision ids, and non-string constraints. It throws the existing
`RoleContractError` with stable, path-prefixed issues so callers can pattern
match and tests stay readable.

### D3 — Role-scoped exposure

The orchestrator keeps `approvedStrategy = null` per run. After a successful
(COMPLETED) ARCHITECT invocation it builds the strategy from that result's
`decisions` plus `accumulated.constraints` at that moment. Only the BUILDER
request receives `input.approvedStrategy`. ANALYST and REVIEWER never do.

### D4 — Fail loud at the BUILDER boundary

`requireApprovedStrategy` throws `AgentOrchestrationError` when a BUILDER
invocation has no strategy. The request boundary additionally validates shape
when `approvedStrategy` is present, via a local validator in `role-contracts.js`
to avoid a circular import with `approved-strategy.js` (which imports
`RoleContractError`).

### D5 — REPLAN replaces, never merges

On `REPLAN_REQUIRED`, constraints are reset to base constraints plus review
findings, ARCHITECT runs again, and `approvedStrategy` is rebuilt from the new
result. The previous strategy object is discarded; no stale decisions survive.

## Alternatives considered

### A1 — Pass the existing free-text constraints only (rejected)

Keep flattening decisions into strings and rely on ordering. Rejected: strings
cannot be validated structurally, so a missing or stale plan is not detectable.
It also gives no way to prove which ARCHITECT result BUILDER received.

### A2 — Store the strategy on task state and read it later (rejected)

Persist `approvedStrategy` alongside task state and have BUILDER read it.
Rejected: it introduces cross-run staleness (exactly the failure mode we are
fixing), requires migration and cleanup, and couples a per-run handoff to
long-lived storage. The existing task-level strategy in `src/execution/` is a
different concept and is left untouched.

### A3 — Have ARCHITECT emit the fully built strategy object (rejected)

Let ARCHITECT return the frozen object directly in its result. Rejected: it
would change the result contract for every role, let the producer approve its
own strategy (contradicting the existing ARCHITECT limit), and remove the
orchestrator's separation of proposal from approval. Keeping `approvedBy:
"ORCHESTRATOR"` preserves the two-party check.

## Risks

- Adding a required input for BUILDER changes orchestration behavior for any
  caller that invokes BUILDER directly without going through ARCHITECT. The
  guard intentionally fails loud; such callers must build a strategy explicitly.
- Duplicated shape validation between `approved-strategy.js` and
  `role-contracts.js` is deliberate to keep module boundaries acyclic. Both are
  covered by tests.
- The strategy includes every accumulated constraint, including free-text
  review findings, so its content can grow on long runs. Constraints are already
  bounded by the existing orchestration inputs; no new growth mechanism is added.
