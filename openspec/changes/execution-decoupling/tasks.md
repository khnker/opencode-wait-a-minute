# Tasks: Execution Decoupling

- [x] 1. Define `ExecutionPlan` schema in `execution-planner.js` (JSON Schema, versioned).
- [x] 2. Implement `planReasoningPhase(task)` producing an `ExecutionPlan` without side effects.
- [x] 3. Implement execution strategies:
    - [x] `executeSequential(plan)`
    - [x] `executeTransactional(plan)` with sandbox + commit/rollback
    - [x] `executeDryRun(plan)` emitting diff
    - [x] `executeReplay(plan, fixture)` for deterministic testing
- [x] 4. Implement preconditions/postconditions evaluator; rollback per step.
- [x] 5. Wire agent loop: reasoning produces plan → human/reviewer approves (optional) → execution applies plan.
- [x] 6. Ensure plan respects assessment scope (steps outside scope BLOCKED).
- [x] 7. Add tests:
    - [x] Plan produced from reasoning phase is purely declarative (no side effects in the producing function).
    - [x] Sequential strategy halts on failure and emits drift.
    - [x] Transactional strategy rolls back fully on postcondition failure.
    - [x] Dry-run produces diff without mutating.
    - [x] Replay reproduces recorded behavior against a fixture.
    - [x] Out-of-scope steps are rejected.
- [x] 8. End-to-end test: reasoning phase runs without filesystem mutation; execution phase applies plan with rollback on simulated failure.