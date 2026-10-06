# Source Ownership Map

Status: first pass (RC1 pre-work, change 4 of 5)
Date: 2026-10-05

All 124 production modules in `src/` are assigned exactly one owner.

## Counts

| Pillar | Modules |
|---|---|
| `preflight` | 9 |
| `context` | 54 |
| `task` | 21 |
| `execution` | 13 |
| `verification` | 15 |
| `skills` | 2 |
| `runtime` | 5 |
| `orchestration` | 2 |
| `shared` | 3 |
| **total** | **124** |

## preflight (9)

- `src/assessment-engine.js`
- `src/assumption-tracking.js`
- `src/execution-assessment.js`
- `src/governance-enforcement.js`
- `src/multi-signer.js`
- `src/policy-state-machine.js`
- `src/ponytail-constraint.js`
- `src/risk-engine.js`
- `src/scope-enforcement.js`

## context (54)

- `src/active-context-boundary.js`
- `src/assembly.js`
- `src/capsule-staleness.js`
- `src/context.js`
- `src/context-assembly-contract.js`
- `src/context-budget-manager.js`
- `src/context-builder.js`
- `src/context-capture.js`
- `src/context-classification.js`
- `src/context-compaction.js`
- `src/context-decision-audit.js`
- `src/context-demotion.js`
- `src/context-dictionary.js`
- `src/context-drift-detection.js`
- `src/context-evaluation.js`
- `src/context-event-ingress.js`
- `src/context-event-normalization.js`
- `src/context-feedback-loop.js`
- `src/context-freshness.js`
- `src/context-graph.js`
- `src/context-graph-builder.js`
- `src/context-history-relevance.js`
- `src/context-interception.js`
- `src/context-invalidation-events.js`
- `src/context-lifecycle.js`
- `src/context-loop-prevention.js`
- `src/context-manager.js`
- `src/context-memory-layers.js`
- `src/context-minimality.js`
- `src/context-normalization.js`
- `src/context-optimization-metrics.js`
- `src/context-output-policy.js`
- `src/context-pack-authority.js`
- `src/context-promotion.js`
- `src/context-query-contract.js`
- `src/context-ranking.js`
- `src/context-rate-distortion.js`
- `src/context-recovery.js`
- `src/context-retrieval.js`
- `src/context-retrieval-integration.js`
- `src/context-router.js`
- `src/context-routing-evaluation.js`
- `src/context-routing-observability.js`
- `src/context-routing-shadow.js`
- `src/context-scope.js`
- `src/context-snapshot.js`
- `src/context-source-registry.js`
- `src/context-sufficiency-gate.js`
- `src/context-sufficiency-oracle.js`
- `src/context-telemetry.js`
- `src/dependency-closure.js`
- `src/page-fault-tracker.js`
- `src/runtime-context-graph.js`
- `src/sufficiency-contract.js`

## task (21)

- `src/cognition-store.js`
- `src/cognitive-state.js`
- `src/hypothesis-manager.js`
- `src/memory.js`
- `src/observation-engine.js`
- `src/observation-provenance.js`
- `src/operational-state.js`
- `src/persistence-manager.js`
- `src/requirement-ownership.js`
- `src/requirement-state.js`
- `src/run-event-identity.js`
- `src/state-engine.js`
- `src/state-machine.js`
- `src/state-schema.js`
- `src/state-store.js`
- `src/state-transition.js`
- `src/task-dependencies.js`
- `src/task-execution.js`
- `src/task-runs.js`
- `src/transaction-log.js`
- `src/wam-state.js`

## execution (13)

- `src/action-evaluation.js`
- `src/claim-interception.js`
- `src/execution-engine.js`
- `src/execution-intent.js`
- `src/execution-state.js`
- `src/formatting.js`
- `src/l1-sanitize.js`
- `src/l2-resource-guards.js`
- `src/l3-invariant-checker.js`
- `src/l4-containment.js`
- `src/runtime-guards.js`
- `src/strategy-identity.js`
- `src/tool-result-classifier.js`

## verification (15)

- `src/completion-gate.js`
- `src/contradiction-resolution.js`
- `src/evidence.js`
- `src/evidence-engine.js`
- `src/evidence-freshness.js`
- `src/evidence-gap.js`
- `src/evidence-lineage.js`
- `src/false-completion-prevention.js`
- `src/freshness-validation.js`
- `src/verification.js`
- `src/verification-context.js`
- `src/verification-lifecycle.js`
- `src/verification-model.js`
- `src/verification-persistence.js`
- `src/verification-policy.js`

## skills (2)

- `src/engine.js`
- `src/skill-routing.js`

## runtime (5)

- `src/canary-deploy.js`
- `src/logger.js`
- `src/opencode-db.js`
- `src/rollback-manager.js`
- `src/router-adapter.js`

## orchestration (2)

- `src/orchestration.js`
- `src/release-gate.js`

## shared (3)

- `src/decision-types.js`
- `src/simple-test.js`
- `src/wam-events.js`

## Dependency Violations

After reclassification (see below), the direction check reports **0 violations**
and **0 cycles** across the 124 modules.

Reclassifications made to reach 0 violations:

- `formatting.js` was tentatively `shared` but re-exports `getStatusReport` from
  `execution-state.js` → moved to **execution** (not domain-neutral).
- `state-machine.js` was tentatively `shared` but imports `assessment-engine.js`
  (preflight) and `cognition-store.js` (task) → moved to **task** (domain logic).

## Cross-Pillar Imports (monitored, same layer)

| From | Owner | Imports | Owner |
|---|---|---|---|
| `src/action-evaluation.js` | execution | `src/assessment-engine.js` | preflight |
| `src/assembly.js` | context | `src/cognitive-state.js` | task |
| `src/assembly.js` | context | `src/memory.js` | task |
| `src/claim-interception.js` | execution | `src/false-completion-prevention.js` | verification |
| `src/completion-gate.js` | verification | `src/engine.js` | skills |
| `src/completion-gate.js` | verification | `src/requirement-state.js` | task |
| `src/context-history-relevance.js` | context | `src/engine.js` | skills |
| `src/context-history-relevance.js` | context | `src/task-dependencies.js` | task |
| `src/context-history-relevance.js` | context | `src/task-runs.js` | task |
| `src/context-invalidation-events.js` | context | `src/evidence-lineage.js` | verification |
| `src/context-loop-prevention.js` | context | `src/strategy-identity.js` | execution |
| `src/context-routing-evaluation.js` | context | `src/engine.js` | skills |
| `src/context-routing-observability.js` | context | `src/task-dependencies.js` | task |
| `src/context-routing-shadow.js` | context | `src/engine.js` | skills |
| `src/context-routing-shadow.js` | context | `src/task-dependencies.js` | task |
| `src/context-routing-shadow.js` | context | `src/task-runs.js` | task |
| `src/engine.js` | skills | `src/context-decision-audit.js` | context |
| `src/evidence-freshness.js` | verification | `src/engine.js` | skills |
| `src/evidence-lineage.js` | verification | `src/engine.js` | skills |
| `src/evidence-lineage.js` | verification | `src/task-runs.js` | task |
| `src/execution-engine.js` | execution | `src/assessment-engine.js` | preflight |
| `src/execution-engine.js` | execution | `src/cognition-store.js` | task |
| `src/execution-engine.js` | execution | `src/cognitive-state.js` | task |
| `src/execution-engine.js` | execution | `src/engine.js` | skills |
| `src/execution-engine.js` | execution | `src/evidence-engine.js` | verification |
| `src/execution-engine.js` | execution | `src/hypothesis-manager.js` | task |
| `src/execution-engine.js` | execution | `src/observation-engine.js` | task |
| `src/execution-engine.js` | execution | `src/state-machine.js` | task |
| `src/execution-state.js` | execution | `src/verification-lifecycle.js` | verification |
| `src/hypothesis-manager.js` | task | `src/engine.js` | skills |
| `src/hypothesis-manager.js` | task | `src/evidence-lineage.js` | verification |
| `src/memory.js` | task | `src/engine.js` | skills |
| `src/observation-engine.js` | task | `src/assessment-engine.js` | preflight |
| `src/runtime-guards.js` | execution | `src/cognition-store.js` | task |
| `src/runtime-guards.js` | execution | `src/risk-engine.js` | preflight |
| `src/state-machine.js` | task | `src/assessment-engine.js` | preflight |
| `src/task-dependencies.js` | task | `src/context-graph.js` | context |
| `src/task-dependencies.js` | task | `src/engine.js` | skills |
| `src/task-execution.js` | task | `src/engine.js` | skills |
| `src/task-runs.js` | task | `src/engine.js` | skills |

## Unresolved

- `src/simple-test.js` is a standalone dev helper living in `src/`; candidate for
  removal or move to `scripts/` (tracked by repository-structure-modernization).
- `src/verification-policy.js` is currently unimported (orphan); owner verification.
  Tracked by the duplication audit.
