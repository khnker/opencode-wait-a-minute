# Autonomous Task Loop

## ADDED Requirements

### Requirement: Deterministic loop decision

WAM MUST decide the next loop action from persisted task, loop, progress,
completion-gate, authorization and budget snapshots, without calling the host,
the filesystem or an LLM from the controller.

#### Scenario: Continue while work remains

- **WHEN** the task is not terminal, no authorization is pending, the budget is
  not exhausted and the completion gate still has pending work
- **THEN** the controller returns `CONTINUE` with a bounded next action

#### Scenario: Complete only with evidence

- **WHEN** the completion gate reports no pending work and the task is not
  already completed
- **THEN** the controller returns `COMPLETE`
- **AND** an agent claim alone, with pending gate work, never yields `COMPLETE`

#### Scenario: Never resume a terminal task

- **WHEN** the task state is `COMPLETED` or the loop status is `COMPLETED`
- **THEN** the controller returns `COMPLETE` without scheduling new work

### Requirement: Explicit wait and block states

WAM MUST treat authorization and human waits as explicit states, not as errors
or completion.

#### Scenario: Pending authorization

- **WHEN** a pending authorization exists
- **THEN** the controller returns `WAIT_AUTHORIZATION` and does not prompt

#### Scenario: Denied authorization

- **WHEN** authorization is denied
- **THEN** the controller returns `BLOCK`

#### Scenario: Contract not approved

- **WHEN** the caller reports `contractApproved === false`
- **THEN** the controller returns `WAIT_USER`

### Requirement: Bounded and stagnation-aware execution

WAM MUST stop a loop that exhausts its iteration budget or repeats iterations
without verifiable progress.

#### Scenario: Budget exhausted

- **WHEN** the budget is exhausted or the iteration limit is reached
- **THEN** the controller returns `STOP_BUDGET`

#### Scenario: No progress

- **WHEN** consecutive no-progress iterations reach the configured maximum
- **THEN** the controller returns `STOP_STAGNATION`

### Requirement: Persistent run-scoped loop state

WAM MUST persist one loop run per task execution with a schema version, atomic
snapshot writes, append-only events and replay-based recovery, without
duplicating requirements, hypotheses or experiments.

#### Scenario: Restart recovery

- **WHEN** a snapshot exists and newer events were appended
- **THEN** recovery replays the newer events on top of the snapshot

#### Scenario: Corrupt snapshot

- **WHEN** the snapshot JSON is corrupt
- **THEN** recovery does not overwrite it and reconstructs state from events

#### Scenario: Idempotent event

- **WHEN** an event with an existing `eventId` is appended again
- **THEN** it is ignored and no duplicate action is recorded

### Requirement: Host-independent continuation

WAM MUST keep OpenCode V1 knowledge inside the adapter and persist the decision
before performing an external effect.

#### Scenario: Idle session with pending work

- **WHEN** `session.idle` fires for an eligible task and the controller returns
  `CONTINUE`
- **THEN** the adapter persists the decision before calling
  `client.session.prompt`

#### Scenario: Duplicate idle event

- **WHEN** the same turn already produced a continuation
- **THEN** the adapter does not send a second prompt

#### Scenario: Auto-continuation owns the idle

- **WHEN** the post-DONE auto-continuation sends a prompt for the same idle
- **THEN** the task loop does not also send a continuation prompt for that idle

#### Scenario: Disabled feature flag

- **WHEN** `taskLoop.enabled` is false
- **THEN** no automatic loop prompt is sent
