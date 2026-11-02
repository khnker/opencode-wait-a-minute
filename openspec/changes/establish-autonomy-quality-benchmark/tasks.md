# Tasks

## Phase 1: Schema

- [x] 1.1 Add `benchmarks/autonomy/schema.mjs` with `wam.autonomy.benchmark/1`
- [x] 1.2 Implement `validateRunRecord()` returning deterministic errors
- [x] 1.3 Add a golden fixture and a reproducibility test

## Phase 2: Harness

- [ ] 2.1 Define the task-suite format (task id, kind, prompt, expected outcome, oracle defects)
- [ ] 2.2 Implement the runner for the four configurations
- [ ] 2.3 Collect tokens, iterations, decisions, quality, review and context metrics from events
- [ ] 2.4 Add the no-WAM baseline adapter

## Phase 3: Methodology

- [ ] 3.1 Enforce paired runs with fixed model, tools, budget and seed
- [ ] 3.2 Implement deterministic aggregation and bootstrap confidence intervals
- [ ] 3.3 Implement per-feature ablations
- [ ] 3.4 Freeze a release baseline

## Phase 4: Integration

- [ ] 4.1 Consume `quality.evaluated` from Change 08
- [ ] 4.2 Consume review findings from Change 09
- [ ] 4.3 Consume autonomy-level and downgrade events from Change 11
- [ ] 4.4 Consume strategy recommendations from Change 12

## Phase 5: Validation

- [ ] 5.1 Run a 3-task smoke per configuration
- [ ] 5.2 Verify byte-identical reports across repeats
- [ ] 5.3 Document metric definitions and the fairness protocol
- [ ] 5.4 Run `openspec validate --changes --strict`
