# Design: Outcome-Based Completion

## 1. Outcome contract

Each task receives an outcome contract before execution.

Required fields:

- `task_id`: stable task identifier.
- `outcome_type`: `state_change`, `behavior_change`, `knowledge`, `performance`, or `decision`.
- `objective`: the intended result.
- `acceptance_criteria`: observable conditions that define success.
- `verification_plan`: the method used to assess each criterion.

Conditional fields:

- `baseline`: initial state or measurement, when comparison is necessary.
- `target`: expected final state or quantitative threshold, when applicable.
- `constraints`: invariants and behaviors that must remain unchanged.
- `scope`: systems, files, behaviors, or claims covered by the conclusion.

The contract MUST distinguish user requirements from agent assumptions. Missing information that materially affects the success criteria must remain explicit rather than being silently invented.

## 2. Outcome model

Maintain three independent dimensions:

### Execution

What was attempted or performed: investigation, edits, commands, tests, experiments, and external actions.

### Outcome

What changed or was established relative to the objective: achieved, partially achieved, not achieved, or undetermined.

### Verification

How strongly the available evidence supports the outcome claim: verified, failed, or unknown.

These dimensions MUST NOT be collapsed into a single progress indicator.

## 3. Outcome record

The outcome evaluator produces a structured record containing:

- `contract`: the objective and acceptance criteria.
- `baseline`: the initial state or an explicit declaration that it is unavailable.
- `observations`: measured or inspected final-state facts.
- `delta`: the observed difference, when applicable.
- `criteria_results`: per-criterion result and supporting evidence references.
- `regressions`: violated constraints or detected negative side effects.
- `evidence_refs`: references to the underlying evidence.
- `verification_method`: the method used to evaluate the result.
- `status`: the derived outcome status.
- `limitations`: unresolved uncertainty and scope limitations.

The evaluator MUST derive status from the contract and evidence. It MUST NOT accept the agent's narrative summary as proof.

## 4. Outcome statuses

- `ACHIEVED`: all mandatory acceptance criteria are satisfied by sufficient evidence.
- `PARTIAL`: some criteria are satisfied, but at least one mandatory criterion remains unmet or unresolved.
- `NOT_ACHIEVED`: evidence demonstrates that the objective was not achieved.
- `UNVERIFIED`: evidence is insufficient to determine whether the objective was achieved.

A separate execution status records whether work is in progress, finished, or blocked.

`DONE` is a terminal completion decision permitted only when the outcome is `ACHIEVED`, all mandatory criteria are verified, and no blocking regression or outstanding requirement remains.

`PARTIAL`, `NOT_ACHIEVED`, and `UNVERIFIED` MUST NOT be promoted to `DONE`.

## 5. Evidence requirements

Evidence must support the specific criterion it is used to verify.

Examples:

- State changes: inspect the relevant before-and-after state.
- Behavior changes: execute reproducible tests or observe the target behavior.
- Performance changes: compare measurements under equivalent conditions.
- Investigations: support conclusions with source material, experiments, or reproducible observations.
- Decisions: establish that the requested decision was made using the required inputs and constraints.

Evidence records should preserve their origin, verification method, relevant artifact or source, and enough information to reproduce or audit the conclusion.

A passing unit test proves only what that test covers. A successful build does not independently prove behavioral correctness.

## 6. Baselines and unknown initial state

When a task requires a state comparison, WAM should capture the baseline before modifying that state.

If the baseline cannot be obtained, WAM must record the limitation. It may still verify an independently observable target state when the contract permits this, but it must not claim an observed improvement over an unknown baseline.

For investigation or knowledge tasks, the baseline may instead be the original question, existing evidence, known constraints, or an explicitly documented hypothesis.

## 7. Integration with the existing lifecycle

Preserve:

CLAIM → ACTION → OBSERVATION → EVIDENCE → VERIFIED

Extend its semantics:

- `CLAIM`: defines the intended outcome and criteria.
- `ACTION`: records attempted work.
- `OBSERVATION`: captures the resulting state or behavior.
- `EVIDENCE`: links observations to criteria with provenance.
- `VERIFIED`: means the relevant claim is supported by the required evidence.
- `DONE`: requires achieved outcome, verified mandatory criteria, and no blocking work.

`VERIFIED` MUST remain a claim-level verification state. It MUST NOT automatically mean the entire task is `DONE`.

Integrate the outcome decision into the existing completion gate rather than introducing a competing state machine.

## 8. Scope of claims

WAM must report conclusions at the scope actually supported by evidence.

A verified improvement in one repository, task, or test corpus is a local result. It does not establish a general state-of-the-art improvement.

Claims about state-of-the-art performance require a defined comparison set, relevant baselines, comparable experimental conditions, and evidence supporting the broader claim. Otherwise, WAM must report the narrower observed result.

## 9. Compatibility and migration

- Preserve existing evidence records and task persistence formats where possible.
- Treat legacy tasks without outcome contracts as requiring migration or an explicit compatibility policy.
- Do not silently reinterpret legacy `VERIFIED` records as outcome-verified.
- Keep deterministic tests independent of live provider availability.
- Preserve separation between deterministic, simulated, and real-provider benchmark results.

## 10. Failure handling

Missing evidence, evaluator errors, malformed outcome contracts, and unresolved mandatory criteria must fail closed for `DONE`.

The system must retain enough diagnostic information to explain which criteria failed, remain unknown, or lack evidence.

## 11. Architectural boundaries

Reuse existing task state, evidence, observation, verification, and completion-gate components. Introduce new abstractions only where existing contracts cannot represent outcome criteria or their evaluation.

Before implementation, inspect the current completion gate and evidence model to avoid duplicating existing capabilities.
