# Design: Harden Context Efficiency Validation

## Scope

* Language: JavaScript ESM (`.mjs`), zero new runtime dependencies.
* Validates existing behavior only; MUST NOT modify snapshot semantics, context assembly algorithm, WAM runtime behavior, token accounting, or add a provider-specific runner.

## Causal Model Under Test

```
snapshot state -> continuation decision -> context reconstruction -> token consumption -> verified task result
```

## Snapshot State Machine Coverage

The benchmark drives the snapshot state machine directly:

| State | Trigger | Expected behavior |
|-------|---------|-------------------|
| `VALID` | no relevant state changed | fast-path, no unnecessary rebuild |
| `STALE` (git revision) | revision changed, task state valid | partial/required rebuild, no stale reuse |
| `STALE` (project context) | relevant project context changed | project-context rebuild |
| `INVALID` (task state) | task state changed | full rebuild |
| Invalid | malformed/missing/incompatible snapshot | safe fallback, no fast-path |

## Mutation Matrix

Scenarios mutate exactly one dimension at a time — `gitRevision`, `relevantFilesHash`, `projectContextHash`, `taskStateHash` — so invalidations are attributable. Unrelated mutations MUST NOT unnecessarily invalidate the snapshot.

## Workload Families

* `local` — minimal context; measures fixed overhead.
* `contextual` — requires project/domain context; measures selective assembly.
* `continuation` — multi-turn; measures fast-path and avoided rebuilds.
* `negative` — overhead exceeds savings; validates negative results are preserved.

Continuation workload scales over turn counts `1, 3, 5, 10, 20`.

## Metrics

Per scenario: `turns`, `contextRebuilds`, `fastPathCount`, `partialRebuildCount`, `fullRebuildCount`, `inputTokens`, `outputTokens`, `totalTokens`, `verification`.
Report-level: tokens per rebuild, tokens per verified task, rebuild reduction %, input reduction %, total reduction %.

## Regression Controls

Explicit assertions for: no false `VALID`, no skipped required rebuild, no stale task state, no stale project context, no lost verification, no negative-savings clamping. The benchmark MUST NOT assert that WAM always saves tokens.

## Charts

* rebuild vs token cost;
* savings by scenario (controls retained);
* continuation scaling;
* snapshot state distribution (`VALID`/`STALE`/`INVALID`).

## Aggregation

Aggregated savings are reported with workload composition: scenario count, run count, negative-control count, verification success, and token source. A bare aggregate percentage MUST NOT be presented without this context.
