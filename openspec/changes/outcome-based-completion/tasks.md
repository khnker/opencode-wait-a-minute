# Tasks: Outcome-Based Completion

## Contract and Model
- [ ] Define outcome contract schema and validation rules.
- [ ] Define outcome statuses (`ACHIEVED`, `PARTIAL`, `NOT_ACHIEVED`, `UNVERIFIED`) and relationship to completion gate.

## Implementation
- [ ] Implement outcome contract parsing and validation.
- [ ] Implement outcome evaluator connecting observations and evidence to acceptance criteria.
- [ ] Integrate outcome evaluation into the completion gate (blocking `DONE` on unmet/unverified criteria).
- [ ] Ensure fail-closed behavior on evaluator errors or missing evidence.

## Tests
- [ ] Add unit tests for outcome contract validation.
- [ ] Add unit tests for outcome status derivation (ACHIEVED vs PARTIAL vs NOT_ACHIEVED vs UNVERIFIED).
- [ ] Add integration tests verifying completion gate blocks `DONE` when actions succeed but outcome is unverified.

## Benchmark
- [ ] Add benchmark scenario evaluating outcome correctness vs action completion.
