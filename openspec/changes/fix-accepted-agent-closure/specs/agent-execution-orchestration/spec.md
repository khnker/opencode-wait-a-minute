# Agent execution orchestration

## ADDED Requirements

### Requirement: Accepted agent runs verify requirements with reviewer evidence

WAM MUST treat a `COMPLETED` / `ACCEPTED` agent run as verification evidence:
it MUST mark each non-verified requirement `verified` and MUST append reviewer
evidence to it. WAM MUST NOT mark requirements from accepted `ANALYZE` runs.
The Completion Gate MUST still evaluate contract checks and the outcome contract
before the task is complete.

#### Scenario: Accepted implementation run with pending or done requirements

- **WHEN** the agent run is `COMPLETED` / `ACCEPTED` for an `IMPLEMENT` task and
  a requirement is `pending` or `done`
- **THEN** the requirement becomes `verified`
- **AND** its evidence includes the reviewer summary, reviewer evidence, or
  reviewer artifacts
- **AND** `verifiedAt` is recorded

#### Scenario: Accepted analysis run

- **WHEN** the agent run is `COMPLETED` / `ACCEPTED` for an `ANALYZE` task
- **THEN** requirement statuses and evidence remain unchanged

#### Scenario: Rejected or blocked run

- **WHEN** the agent run is not `COMPLETED` / `ACCEPTED`
- **THEN** requirement statuses and evidence remain unchanged

### Requirement: A satisfied completion gate closes the loop

The task loop MUST treat a Completion Gate result with `allDone: true` as
complete, regardless of whether it also returns an explicit empty `pending`
array. An accepted agent run MUST NOT force `VERIFY` when the gate is already
satisfied. A `COMPLETE` decision MUST persist the task phase as `DONE` with a
completed next action.

#### Scenario: Gate satisfied after an accepted run

- **WHEN** the agent run is `COMPLETED` / `ACCEPTED`
- **AND** the Completion Gate returns `blocked: false` and `allDone: true`
- **THEN** the decision is `COMPLETE` with reason `evidence-complete`
- **AND** the persisted task phase is `DONE`

### Requirement: No-progress stops the loop before verification

The task loop MUST evaluate the no-progress stagnation guard before the
verification-required branch. Pending verification MUST NOT keep a loop alive
after `consecutiveNoProgress` reaches `maxNoProgress`.

#### Scenario: Pending verification with an exhausted progress streak

- **WHEN** the completion gate has pending items, `requiresVerification` is true,
  and `consecutiveNoProgress` has reached `maxNoProgress`
- **THEN** the decision is `STOP_STAGNATION` with reason `no-progress`

#### Scenario: Fresh pending verification

- **WHEN** the completion gate has pending items and the no-progress streak has
  not reached `maxNoProgress`
- **THEN** the decision remains `VERIFY` with reason `verification-required`
