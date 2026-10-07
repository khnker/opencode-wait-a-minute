# Causal Decision Matrix

Each row perturbs one variable while holding the system fixed, and states the
expected effect. Status is **PASS**, **FAIL**, or **NOT IMPLEMENTED**.

| # | Variable | Perturbation | Expected effect | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Execution state | Transition to a state not in `ALLOWED_TRANSITIONS` (e.g. `INITIALIZING → VERIFYING`) | Throw (invalid transition) | PASS | `src/execution/execution-state.js`; `tests/unit/state-machine.test.mjs` |
| 2 | Outstanding work | Transition to `COMPLETED` while `hasOutstandingWork` is true | Throw (fail-closed) | PASS | `src/execution/execution-state.js`; `tests/unit/completion-gate.test.mjs`, `tests/unit/completion-gate-e2e.test.mjs` |
| 3 | Mandatory requirement | Evaluate completion with a mandatory requirement unverified | `blocked: true` | PASS | `src/verification/verification-policy.js`; `tests/unit/false-completion-prevention.test.mjs`, `tests/unit/verification-lifecycle.test.mjs` |
| 4 | Context level | Assemble a pack with N3 present and N2 absent | Budget warning `"N3 context used to substitute missing N2"` | PASS | `src/context/assembly.js`; `tests/unit/verification-context.test.mjs`, `tests/unit/context-tests.test.mjs` |
| 5 | Evidence conflict | One evidence item supports and another contradicts | Resolve to `UNKNOWN` (never support) | PASS | `src/evidence/evidence.js`; `tests/unit/evidence-conflict.test.mjs` |
| 6 | Skill relevance | Prompt matches a skill capability vs. matches none | Relevant skill selected; unrelated skill not selected | PASS | `src/skills/engine.js`; `tests/unit/skill-routing.test.mjs` |
| 7 | Task boundary | Complete Task A, then start Task B | Task B starts fresh (`active`, no inherited `completedAt`) | PASS | `src/context/active-context-boundary.js`; `tests/isolation/run.mjs` |
| 8 | Real-model decision | Same state and inputs under real model execution | Same control decision (determinism) | NOT IMPLEMENTED | No real-model harness; see [Premise](premise.md) |

## Not implemented (tracked)

- **Real-model end-to-end determinism** (row 8) — no harness executes the same
  task twice against a real provider with equivalent accounting.
- **Real-model context reduction ≥ 60%** — the release threshold is not measured
  by any reproducible harness. The deterministic harness reports 69.6% and the
  dry-run reports negative net input savings; neither is a real-model measurement.
  See [Benchmark Results](../benchmarks/results.md).

## How to run

```bash
node --test tests/unit/state-machine.test.mjs \
  tests/unit/completion-gate.test.mjs \
  tests/unit/evidence-conflict.test.mjs \
  tests/unit/skill-routing.test.mjs
node tests/isolation/run.mjs
```
