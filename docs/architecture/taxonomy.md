# Architecture Taxonomy

Status: first pass (RC1 pre-work, change 4 of 5)
Date: 2026-10-05

Source of truth for where code belongs. Derived from the 124 production modules in `src/`.

## Pillars

| Pillar | Responsibility |
|---|---|
| `preflight` | Decides whether/how execution may begin: assessment, diagnosis, assumptions, risk, scope, governance, pre-execution policy, authorization. |
| `context` | Owns context: classification, capture, routing, assembly, budgeting, compression, freshness, sufficiency, levels N0-N3. |
| `task` | Owns task identity and lifecycle: state, persistence, recovery, requirements, runs, cognition store, observations, hypotheses. |
| `execution` | Owns execution control: interception, guards, safety layers, execution state, action evaluation, tool-result classification. |
| `verification` | Owns correctness evidence: claims, evidence, gaps, lineage, completion gates, verification lifecycle/policy/model. |
| `skills` | Owns capability registration and discovery: skill registry, capability discovery, routing metadata. |
| `runtime` | Owns integration with external/runtime environments: logger, OpenCode DB, router adapter, deploy/rollback. |
| `orchestration` | Coordinates pillars (sequencing, release gate). MUST NOT own pillar domain logic. |
| `shared` | Domain-neutral infrastructure only. MUST NOT import pillars, runtime, or orchestration. |

## Dependency Direction

```text
runtime adapters
      ↓
orchestration
      ↓
pillars (preflight/context/task/execution/verification/skills)
      ↓
shared
```

- Pillars MUST NOT depend on `orchestration`.
- `shared` MUST NOT depend on domain pillars, `runtime`, or `orchestration`.
- `orchestration` MUST NOT depend on `runtime`.

## Rules

- Ownership is by semantic responsibility, not by caller count.
- A new pillar requires: a distinct major capability, multiple internal
  responsibilities, an independent lifecycle/invariants, and a real boundary.
- `shared` is only for domain-neutral, cross-pillar, stable infrastructure.

