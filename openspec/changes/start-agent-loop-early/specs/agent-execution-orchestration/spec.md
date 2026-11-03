# Agent execution orchestration

## ADDED Requirements

### Requirement: Non-inline tasks start the agent pass on the first message

WAM MUST classify a non-trivial prompt as `IMPLEMENT` or `ANALYZE` and MUST
start the configured agent pass from `chat.message` when a pass is still
required. `session.idle` remains a fallback, not the only trigger.

#### Scenario: First implementation message

- **WHEN** the main session sends a non-trivial implementation prompt and no
  accepted/exhausted `agentRun` exists
- **THEN** WAM persists an active `executionGate`
- **AND** starts the agent pass without waiting for `session.idle`

#### Scenario: Already completed pass

- **WHEN** the task already has `agentRun.status = COMPLETED` and
  `agentRun.verdict = ACCEPTED`
- **THEN** WAM does not start another pass and does not set the gate

#### Scenario: Trivial edit

- **WHEN** the prompt is classified as `INLINE`
- **THEN** WAM keeps the current inline behavior and sets no execution gate

### Requirement: The execution gate blocks main-session mutations

While `executionGate.active` is true, WAM MUST reject mutating tool calls from
the main session. Worker sessions MUST remain exempt so they can execute the
delegated plan.

#### Scenario: Main session edit during the pass

- **WHEN** the main session calls `write` or `edit` while the gate is active
- **THEN** WAM throws a policy block and injects a directive explaining that the
  agent pass is still running

#### Scenario: Worker session edit during the pass

- **WHEN** a subagent session calls `write` or `edit`
- **THEN** WAM does not apply the execution gate

#### Scenario: Read-only work during the pass

- **WHEN** the main session calls a read-only tool or a read-only shell command
- **THEN** WAM allows it

### Requirement: Analysis uses a read-only pipeline

An `ANALYZE` task MUST run `ANALYST`, then `ARCHITECT`, then `REVIEWER`. It MUST
NOT invoke `BUILDER` and MUST NOT require an approved implementation strategy.

#### Scenario: Analysis completes

- **WHEN** the orchestrator runs with `mode = ANALYZE`
- **THEN** the roles invoked are exactly `ANALYST`, `ARCHITECT`, `REVIEWER`
- **AND** the outcome is based on the reviewer verdict

### Requirement: Approved contracts do not stay in PROPOSED

WAM MUST normalize the phase to `IMPLEMENTING` when the persisted state has
`contract.status = APPROVED` and `phase = PROPOSED`.

#### Scenario: Reopening an approved task

- **WHEN** WAM loads a task with an approved contract and `PROPOSED` phase
- **THEN** the persisted phase becomes `IMPLEMENTING` with an implementation
  next action
