# Design: add-retention-policy

## Research

- W3C PROV-DM — provenance entities/activities/agents and derivations; evidence
  must stay traceable to the claim it supports.
  https://www.w3.org/TR/prov-dm/
- NIST SP 800-88 Rev. 1 — retention/sanitization decisions are risk-based and
  must preserve what is still needed before destruction.
  https://csrc.nist.gov/pubs/sp/800/88/r1/final
- Dependency-aware collection — mark-and-sweep / tracing GC: reachable objects
  are retained, unreachable ones are collectable.
  https://en.wikipedia.org/wiki/Tracing_garbage_collection

## Decision

Implement a **standalone pure planner** that is reused later by the projection
phase. It reads the phase-1 retention policies and relation types, computes a
plan, and leaves application to the caller.

### Rules

| retention | outcome |
|---|---|
| `active`, `durable` | `keep` |
| `archivable` | `archive`; `keep` if referenced by an active/durable item; never `discard` |
| `ephemeral` | `discard` only if `canDiscard(item)` is true, no live item references it, and it is not the sole justification of a live claim |
| unknown | `keep` (fail safe) |

**Sole justification**: an `EVIDENCE` item supporting a `CLAIM`/`REQUIREMENT`
whose status is not `invalidated`/`superseded`, when no other evidence supports
that same claim. Such an item goes to `keep` and `blocked` with a concrete reason.

Determinism: all output arrays are sorted by id; no timestamps or iteration-order
dependence. `applyRetentionPlan` returns the original item objects (archived
entries keep `sourceRefs`) and never mutates input.

## Alternatives rejected

**A. Keep age/TTL-only pruning (status quo).** Rejected: it is blind to
relations, so it can discard the sole evidence for a live claim. It also
conflates task archival TTL with context-item retention.

**B. Wire the policy straight into `context-compaction.js` pruning now.**
Rejected for this phase: compaction is shared by the hook and assembly paths and
changing it here would mix a behaviour change with a new, unproven policy. A
standalone planner is testable in isolation and lets the projection phase adopt
it behind a deliberate, reviewable change. Compaction stays untouched.

## Risks

- Relation types that encode support under unknown names are only recognised by
  the `support|justif|evidence|prove` heuristic; phase 1 can extend the enum.
- The planner decides; it does not enforce. Until the projection phase calls it,
  behaviour is unchanged by design.
