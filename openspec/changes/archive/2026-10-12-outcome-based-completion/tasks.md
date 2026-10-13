# Tasks: Outcome-Based Completion

## 1. Contract and Model
- [x] 1.1 Define outcome contract schema and validation rules.
- [x] 1.2 Define outcome statuses (`ACHIEVED`, `PARTIAL`, `NOT_ACHIEVED`, `UNVERIFIED`) and relationship to completion gate.

## 2. Implementation
- [x] 2.1 Implement outcome contract parsing and validation.
- [x] 2.2 Implement outcome evaluator connecting observations and evidence to acceptance criteria.
- [x] 2.3 Integrate outcome evaluation into the completion gate (blocking `DONE` on unmet/unverified criteria).
- [x] 2.4 Ensure fail-closed behavior on evaluator errors or missing evidence.

## 3. Seeding (P0a — completion-gate deadlock)
- [x] 3.1 Seed a valid `outcomeContract` in `persistTaskState` on first persist: `{ taskId, objective, acceptanceCriteria: [{ id, description, mandatory }] }`.
- [x] 3.2 Fall back `objective` to request/title/requirement titles/taskId and keep a single stable mandatory criterion (`outcome-evaluation`).
- [x] 3.3 Bridge requirement verification evidence onto the mandatory outcome criterion so verified tasks are not deadlocked.
- [x] 3.4 Backward compat: tasks persisted without a contract remain blocked by the gate (fail-closed).

## 4. Tests
- [x] 4.1 Add unit tests for outcome contract validation.
- [x] 4.2 Add unit tests for outcome status derivation (ACHIEVED vs PARTIAL vs NOT_ACHIEVED vs UNVERIFIED).
- [x] 4.3 Add integration tests verifying completion gate blocks `DONE` when actions succeed but outcome is unverified.
- [x] 4.4 Add seeding tests: persisted contract ⇒ allowed with verified evidence; missing contract ⇒ blocked (`Missing outcome contract`).

## 5. Benchmark
- [x] 5.1 Add benchmark scenario evaluating outcome correctness vs action completion.
