# outcome-based-completion Specification

## Purpose
TBD - created by archiving change outcome-based-completion. Update Purpose after archive.
## Requirements
### Requirement: Outcome Contract Definition
- Each task MUST have an outcome contract defining its objective, acceptance criteria, and verification plan prior to completion evaluation.
- The contract MUST distinguish mandatory acceptance criteria from optional/stretch criteria.
#### Scenario: Define outcome contract before starting work
Given a new task is created
When the task is accepted
Then an outcome contract MUST be defined with objective, acceptance criteria, and verification plan
And the contract MUST separate mandatory from optional criteria

### Requirement: Separation of Execution and Outcome
- WAM MUST maintain separate evaluation for execution progress, outcome state (`ACHIEVED`, `PARTIAL`, `NOT_ACHIEVED`, `UNVERIFIED`), and verification confidence.
- Completion of actions, code modifications, or unit tests MUST NOT independently establish outcome attainment.
#### Scenario: Execution does not imply outcome
Given a task has execution progress (e.g., code written)
When the outcome state is NOT_ACHIEVED
Then the task MUST NOT be marked DONE

### Requirement: Completion Gate Enforcement
- `DONE` MUST be blocked unless the outcome is evaluated as `ACHIEVED`, all mandatory criteria are verified with traceable evidence, and no blocking regressions exist.
- Evaluator errors, missing evidence, or malformed contracts MUST fail closed.
#### Scenario: Block DONE when outcome not achieved
Given an outcome state of PARTIAL
When attempting to mark task DONE
Then the completion gate MUST fail and block DONE

### Requirement: Provenance and Baselines
- State-change tasks MUST record baselines when possible; missing baselines MUST be documented as limitations rather than assumed.
- Evidence records MUST link observations directly to the acceptance criteria they support.
#### Scenario: Record baseline for state-change task
Given a state-change task modifies a file
When the task starts
Then a baseline of the file MUST be recorded
And evidence MUST link observations to acceptance criteria

### Requirement: Outcome Contract Seeding
- Every persisted task MUST have an outcome contract; WAM MUST seed one on first persist when absent.
- The seeded contract MUST have a non-empty `objective` and at least one mandatory acceptance criterion with a stable `id`.
- Requirement verification evidence MUST be attributable to the mandatory outcome criterion so a verified task is not deadlocked by an unverifiable contract.
- Tasks persisted without a seeded contract (legacy state) MUST remain blocked by the completion gate (fail-closed).
#### Scenario: Seeded contract allows verified task to complete
Given a task is persisted
When all requirements are verified with evidence
Then the completion gate MUST evaluate the outcome as ACHIEVED and allow DONE
#### Scenario: Missing contract blocks DONE
Given a task state without an outcome contract
When DONE is evaluated
Then the gate MUST block with "Missing outcome contract"

