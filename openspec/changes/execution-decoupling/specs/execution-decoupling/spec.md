# Design: Execution Decoupling

## ADDED Requirements
### Requirement: Two-Phase Model
Every agent action MUST be split into a pure Reasoning phase that produces a serializable ExecutionPlan with tool calls and full arguments, and an effectful Execution phase that applies the plan with optional batching, retries, rollbacks, or human-in-the-loop gates.
#### Scenario: Action blocked due to plan invalidation
- **WHEN** a plan is produced but preconditions fail against current state
- **THEN** the action is BLOCKED and the agent must replan
### Requirement: Serializable Plan Artifact
The ExecutionPlan artifact MUST include planId, taskId, steps (each with id, tool, args, risk, rollback recipe), preconditions, postconditions, and expectedEvidence.
#### Scenario: Plan executed deterministically
- **WHEN** a plan is replayed against a fresh sandbox
- **THEN** the plan produces the same side effects deterministically
### Requirement: Execution Strategies
Four execution strategies MUST be available: sequential (failure halts), transactional (commit only if all postconditions hold), dry-run (plan validated without execution), and replay (pre-recorded plan executed deterministically).
#### Scenario: Transactional execution rolls back on postcondition failure
- **WHEN** a transactional execution step fails its postcondition
- **THEN** the system rolls back all prior steps in the transaction and emits drift
### Requirement: Decoupling Benefits
Plans MUST be reviewable by humans or other agents, queueable, pausable, resumable, and failure-recoverable via rollback recipes; tests MUST run against plans, not agent state.
#### Scenario: Plan can be resumed after pause
- **WHEN** a plan is paused before completion
- **THEN** the plan can be resumed later without losing the intermediate state
### Requirement: Failure Modes
Plan steps that reference files outside assessment scope MUST be BLOCKED; plans that execute but fail postconditions MUST trigger rollback recipes and emit drift.
#### Scenario: Rollback recipe triggered on postcondition failure
- **WHEN** a plan's step fails its postcondition after execution
- **THEN** the corresponding rollback recipe is applied and drift is emitted