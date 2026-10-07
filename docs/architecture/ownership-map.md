# Source Ownership Map

Status: first pass (RC1 pre-work, change 4 of 5)
Date: 2026-10-05

All 124 production modules in `src/` are assigned exactly one owner.

## Counts

| Pillar | Modules |
|---|---|
| `policy` | 9 |
| `context` | 54 |
| `task` | 21 |
| `execution` | 13 |
| `verification` | 15 |
| `skills` | 2 |
| `runtime` | 5 |
| `orchestration` | 2 |
| `shared` | 3 |
| **total** | **124** |

## policy (9)

- `src/policy/assessment-engine.js`
- `src/policy/assumption-tracking.js`
- `src/policy/execution-assessment.js`
- `src/policy/governance-enforcement.js`
- `src/policy/multi-signer.js`
- `src/policy/policy-state-machine.js`
- `src/policy/ponytail-constraint.js`
- `src/policy/risk-engine.js`
- `src/policy/scope-enforcement.js`

## context (54)

- `src/context/active-context-boundary.js`
- `src/context/assembly.js`
- `src/context/capsule-staleness.js`
- `src/context/context.js`
- `src/context/context-assembly-contract.js`
- `src/context/context-budget-manager.js`
- `src/context/context-builder.js`
- `src/context/context-capture.js`
- `src/context/context-classification.js`
- `src/context/context-compaction.js`
- `src/context/context-decision-audit.js`
- `src/context/context-demotion.js`
- `src/context/context-dictionary.js`
- `src/context/context-drift-detection.js`
- `src/context/context-evaluation.js`
- `src/context/context-event-ingress.js`
- `src/context/context-event-normalization.js`
- `src/context/context-feedback-loop.js`
- `src/context/context-freshness.js`
- `src/context/context-graph.js`
- `src/context/context-graph-builder.js`
- `src/context/context-history-relevance.js`
- `src/context/context-interception.js`
- `src/context/context-invalidation-events.js`
- `src/context/context-lifecycle.js`
- `src/context/context-loop-prevention.js`
- `src/context/context-manager.js`
- `src/context/context-memory-layers.js`
- `src/context/context-minimality.js`
- `src/context/context-normalization.js`
- `src/context/context-optimization-metrics.js`
- `src/context/context-output-policy.js`
- `src/context/context-pack-authority.js`
- `src/context/context-promotion.js`
- `src/context/context-query-contract.js`
- `src/context/context-ranking.js`
- `src/context/context-rate-distortion.js`
- `src/context/context-recovery.js`
- `src/context/context-retrieval.js`
- `src/context/context-retrieval-integration.js`
- `src/context/context-router.js`
- `src/context/context-routing-evaluation.js`
- `src/context/context-routing-observability.js`
- `src/context/context-routing-shadow.js`
- `src/context/context-scope.js`
- `src/context/context-snapshot.js`
- `src/context/context-source-registry.js`
- `src/context/context-sufficiency-gate.js`
- `src/context/context-sufficiency-oracle.js`
- `src/context/context-telemetry.js`
- `src/context/dependency-closure.js`
- `src/context/page-fault-tracker.js`
- `src/context/runtime-context-graph.js`
- `src/context/sufficiency-contract.js`

## task (21)

- `src/cognition/cognition-store.js`
- `src/cognition/cognitive-state.js`
- `src/cognition/hypothesis-manager.js`
- `src/persistence/memory.js`
- `src/cognition/observation-engine.js`
- `src/cognition/observation-provenance.js`
- `src/state/operational-state.js`
- `src/persistence/persistence-manager.js`
- `src/state/requirement-ownership.js`
- `src/state/requirement-state.js`
- `src/state/run-event-identity.js`
- `src/state/state-engine.js`
- `src/state/state-machine.js`
- `src/state/state-schema.js`
- `src/state/state-store.js`
- `src/state/state-transition.js`
- `src/state/task-dependencies.js`
- `src/state/task-execution.js`
- `src/state/task-runs.js`
- `src/persistence/transaction-log.js`
- `src/state/wam-state.js`

## execution (13)

- `src/execution/action-evaluation.js`
- `src/execution/claim-interception.js`
- `src/execution/execution-engine.js`
- `src/execution/execution-intent.js`
- `src/execution/execution-state.js`
- `src/execution/formatting.js`
- `src/execution/l1-sanitize.js`
- `src/execution/l2-resource-guards.js`
- `src/execution/l3-invariant-checker.js`
- `src/execution/l4-containment.js`
- `src/execution/runtime-guards.js`
- `src/execution/strategy-identity.js`
- `src/execution/tool-result-classifier.js`

## verification (15)

- `src/verification/completion-gate.js`
- `src/verification/contradiction-resolution.js`
- `src/evidence/evidence.js`
- `src/evidence/evidence-engine.js`
- `src/evidence/evidence-freshness.js`
- `src/evidence/evidence-gap.js`
- `src/evidence/evidence-lineage.js`
- `src/verification/false-completion-prevention.js`
- `src/evidence/freshness-validation.js`
- `src/verification/verification.js`
- `src/verification/verification-context.js`
- `src/verification/verification-lifecycle.js`
- `src/verification/verification-model.js`
- `src/verification/verification-persistence.js`
- `src/verification/verification-policy.js`

## skills (2)

- `src/skills/engine.js`
- `src/skills/skill-routing.js`

## runtime (5)

- `src/integration/canary-deploy.js`
- `src/integration/logger.js`
- `src/integration/opencode-db.js`
- `src/integration/rollback-manager.js`
- `src/integration/router-adapter.js`

## orchestration (2)

- `src/integration/orchestration.js`
- `src/integration/release-gate.js`

## shared (3)

- `src/shared/decision-types.js`
- `src/shared/simple-test.js`
- `src/shared/wam-events.js`

## Dependency Violations

After reclassification (see below), the direction check reports **0 violations**
and **0 cycles** across the 124 modules.

Reclassifications made to reach 0 violations:

- `formatting.js` was tentatively `shared` but re-exports `getStatusReport` from
  `execution-state.js` → moved to **execution** (not domain-neutral).
- `state-machine.js` was tentatively `shared` but imports `assessment-engine.js`
  (policy) and `cognition-store.js` (task) → moved to **task** (domain logic).

## Cross-Pillar Imports (monitored, same layer)

| From | Owner | Imports | Owner |
|---|---|---|---|
| `src/execution/action-evaluation.js` | execution | `src/policy/assessment-engine.js` | policy |
| `src/context/assembly.js` | context | `src/cognition/cognitive-state.js` | task |
| `src/context/assembly.js` | context | `src/persistence/memory.js` | task |
| `src/execution/claim-interception.js` | execution | `src/verification/false-completion-prevention.js` | verification |
| `src/verification/completion-gate.js` | verification | `src/skills/engine.js` | skills |
| `src/verification/completion-gate.js` | verification | `src/state/requirement-state.js` | task |
| `src/context/context-history-relevance.js` | context | `src/skills/engine.js` | skills |
| `src/context/context-history-relevance.js` | context | `src/state/task-dependencies.js` | task |
| `src/context/context-history-relevance.js` | context | `src/state/task-runs.js` | task |
| `src/context/context-invalidation-events.js` | context | `src/evidence/evidence-lineage.js` | verification |
| `src/context/context-loop-prevention.js` | context | `src/execution/strategy-identity.js` | execution |
| `src/context/context-routing-evaluation.js` | context | `src/skills/engine.js` | skills |
| `src/context/context-routing-observability.js` | context | `src/state/task-dependencies.js` | task |
| `src/context/context-routing-shadow.js` | context | `src/skills/engine.js` | skills |
| `src/context/context-routing-shadow.js` | context | `src/state/task-dependencies.js` | task |
| `src/context/context-routing-shadow.js` | context | `src/state/task-runs.js` | task |
| `src/skills/engine.js` | skills | `src/context/context-decision-audit.js` | context |
| `src/evidence/evidence-freshness.js` | verification | `src/skills/engine.js` | skills |
| `src/evidence/evidence-lineage.js` | verification | `src/skills/engine.js` | skills |
| `src/evidence/evidence-lineage.js` | verification | `src/state/task-runs.js` | task |
| `src/execution/execution-engine.js` | execution | `src/policy/assessment-engine.js` | policy |
| `src/execution/execution-engine.js` | execution | `src/cognition/cognition-store.js` | task |
| `src/execution/execution-engine.js` | execution | `src/cognition/cognitive-state.js` | task |
| `src/execution/execution-engine.js` | execution | `src/skills/engine.js` | skills |
| `src/execution/execution-engine.js` | execution | `src/evidence/evidence-engine.js` | verification |
| `src/execution/execution-engine.js` | execution | `src/cognition/hypothesis-manager.js` | task |
| `src/execution/execution-engine.js` | execution | `src/cognition/observation-engine.js` | task |
| `src/execution/execution-engine.js` | execution | `src/state/state-machine.js` | task |
| `src/execution/execution-state.js` | execution | `src/verification/verification-lifecycle.js` | verification |
| `src/cognition/hypothesis-manager.js` | task | `src/skills/engine.js` | skills |
| `src/cognition/hypothesis-manager.js` | task | `src/evidence/evidence-lineage.js` | verification |
| `src/persistence/memory.js` | task | `src/skills/engine.js` | skills |
| `src/cognition/observation-engine.js` | task | `src/policy/assessment-engine.js` | policy |
| `src/execution/runtime-guards.js` | execution | `src/cognition/cognition-store.js` | task |
| `src/execution/runtime-guards.js` | execution | `src/policy/risk-engine.js` | policy |
| `src/state/state-machine.js` | task | `src/policy/assessment-engine.js` | policy |
| `src/state/task-dependencies.js` | task | `src/context/context-graph.js` | context |
| `src/state/task-dependencies.js` | task | `src/skills/engine.js` | skills |
| `src/state/task-execution.js` | task | `src/skills/engine.js` | skills |
| `src/state/task-runs.js` | task | `src/skills/engine.js` | skills |

## Unresolved

- `src/shared/simple-test.js` is a standalone dev helper living in `src/`; candidate for
  removal or move to `scripts/` (tracked by repository-structure-modernization).
- `src/verification/verification-policy.js` is currently unimported (orphan); owner verification.
  Tracked by the duplication audit.
