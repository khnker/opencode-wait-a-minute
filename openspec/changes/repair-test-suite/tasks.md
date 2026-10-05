# Tasks

## 1. Cluster A — context engine

- [x] 1.1 `context-classification.test.mjs` — DECISION/REQUIREMENT content signals
- [x] 1.2 `context-assembly.test.mjs` — N2 mandatory present
- [x] 1.3 `refactor-context-engine.test.mjs` — budget N0+N2
- [x] 1.4 `context.test.mjs` — selector sufficiency "missing declarado"
- [x] 1.5 `test/ingestion-cap.test.mjs` — N2 line exists
- [x] 1.6 `context-manager.test.mjs` — getSource reference equality
- [x] 1.7 `context-evaluation.test.mjs` — relevant context via dependencies
- [x] 1.8 `router-adapter.test.mjs` — executes router and adapts result
- [x] 1.9 `router-sufficiency-integrity.test.mjs` — omitted array / undefined.values
- [x] 1.10 `runtime-context-graph.test.mjs` — reference equality

## 2. Cluster B — execution / verification

- [x] 2.1 `execution-assessment.test.mjs` — assessObservation with/without expected
- [x] 2.2 `execution-loop-e2e.test.mjs` — undefined.id
- [x] 2.3 `task-execution-consolidation.test.mjs` — executions stored in runs/
- [x] 2.4 `test/full-runtime-e2e.test.mjs` — gate should not block when verified
- [x] 2.5 `test/hypothesis-evaluation-e2e.test.mjs` — H1 rejected/archived
- [x] 2.6 `test/runtime-execution-e2e.test.mjs` — contradiction handling
- [x] 2.7 `verification-persistence.test.mjs` — persist/load/snapshot
- [x] 2.8 `verification-service-e2e.test.mjs` — e2e_results present

## 3. Cluster C — release / misc

- [x] 3.1 `release-manager.test.mjs` — canary/rollback/health abort
- [x] 3.2 `strategy-capabilities.test.mjs` — structured capabilities
- [x] 3.3 `state-machine.test.mjs` — status re-exports
- [x] 3.4 `test-gaps-v11.test.mjs` — lifecycle status + phase
- [x] 3.5 `tests/autonomous-task-runner.test.mjs` — EACCES / isolation

## 4. Hangs

- [x] 4.1 `runtime-guard.test.mjs` — terminates under 20s
- [x] 4.2 `scripts/wam-audit.test.mjs` — terminates under 20s

## 5. Runner / gate

- [x] 5.1 Full `npm test` terminates green under `WAM_TEST_TIMEOUT_MS`
- [x] 5.2 `scripts/release-gate.mjs` Test Suite stage PASS
- [x] 5.3 `openspec validate repair-test-suite --strict`
