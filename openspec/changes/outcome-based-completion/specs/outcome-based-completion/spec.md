# Specification: Outcome-Based Completion

## ADDED Requirements

### Requirement 1: Outcome Contract Definition
- Each task MUST have an outcome contract defining its objective, acceptance criteria, and verification plan prior to completion evaluation.
- The contract MUST distinguish mandatory acceptance criteria from optional/stretch criteria.

### Requirement 2: Separation of Execution and Outcome
- WAM MUST maintain separate evaluation for execution progress, outcome state (`ACHIEVED`, `PARTIAL`, `NOT_ACHIEVED`, `UNVERIFIED`), and verification confidence.
- Completion of actions, code modifications, or unit tests MUST NOT independently establish outcome attainment.

### Requirement 3: Completion Gate Enforcement
- `DONE` MUST be blocked unless the outcome is evaluated as `ACHIEVED`, all mandatory criteria are verified with traceable evidence, and no blocking regressions exist.
- Evaluator errors, missing evidence, or malformed contracts MUST fail closed.

### Requirement 4: Provenance and Baselines
- State-change tasks MUST record baselines when possible; missing baselines MUST be documented as limitations rather than assumed.
- Evidence records MUST link observations directly to the acceptance criteria they support.
