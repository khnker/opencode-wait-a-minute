# Agent task loop

## ADDED Requirements

### Requirement: Deterministic task input

The bridge MUST build orchestration input from a WAM task snapshot without
mutating the task. The task id, objective and non-empty acceptance criteria MUST
be derived deterministically. A task without acceptance criteria MUST receive
one mandatory criterion derived from its objective.

#### Scenario: Existing contract

- **WHEN** the task has an outcome contract with acceptance criteria
- **THEN** those criteria are passed with their ids, descriptions, mandatory flags and evidence requirements
- **AND** the task object is not modified

#### Scenario: Missing contract

- **WHEN** the task has no acceptance criteria
- **THEN** the bridge synthesizes one mandatory `task-outcome` criterion from the objective

#### Scenario: Invalid task

- **WHEN** the task has no id or objective
- **THEN** the bridge fails with an integration error

### Requirement: Bounded agent step

`runTaskAgentStep` MUST invoke `runAgentFeedbackOrchestration` with the mapped
input. It MUST return the orchestration outcome, a new task snapshot and the
mapped Task Loop decision. Persistence MUST be opt-in through a callback.

#### Scenario: Successful run

- **WHEN** the adapter completes and the Reviewer accepts
- **THEN** the step returns `COMPLETED` with an accepted verdict
- **AND** the returned decision is `VERIFY`

#### Scenario: Persistence callback

- **WHEN** a persistence callback is supplied
- **THEN** it receives the updated task and the orchestration outcome
- **AND** the bridge performs no filesystem write itself

### Requirement: Bounded result storage

`applyAgentRun` MUST store the latest `agentRun` and an `agentHistory` capped to
the configured maximum. It MUST return a new task and MUST NOT mutate the input
task.

#### Scenario: History cap

- **WHEN** a task already has the maximum number of history entries
- **THEN** the oldest entry is dropped and the newest entry is appended

#### Scenario: Input immutability

- **WHEN** a run is applied to a task
- **THEN** the original task and its history array are unchanged

### Requirement: Task Loop outcome mapping

`decideAgentLoopAction` MUST map terminal agent outcomes to Task Loop decisions.
An accepted review MUST map to `VERIFY`, never `COMPLETE`. `decideNextAction`
MUST accept an optional `agent` outcome and apply the same mapping after budget
and iteration guards.

#### Scenario: Accepted review

- **WHEN** the agent outcome is completed with an accepted verdict
- **THEN** the Task Loop decision is `VERIFY`

#### Scenario: Failed agent

- **WHEN** the agent outcome status is `FAILED`
- **THEN** the Task Loop decision is `BLOCK`

#### Scenario: User input required

- **WHEN** the agent outcome is `BLOCKED`, `NEEDS_INPUT` or exhausted
- **THEN** the Task Loop decision is `WAIT_USER`

#### Scenario: Budget wins

- **WHEN** the loop budget is exhausted and an agent outcome is also present
- **THEN** the Task Loop decision remains `STOP_BUDGET`
