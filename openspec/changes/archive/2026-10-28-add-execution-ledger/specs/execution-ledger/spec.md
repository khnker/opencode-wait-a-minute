# Execution Ledger

## ADDED Requirements

### Requirement: Event-sourced per-task ledger

The system SHALL persist execution state for each task at
`.wam/tasks/<taskId>/execution-ledger.json` with a `version: 1` field, and SHALL update that
state only by applying events.

#### Scenario: Missing ledger yields an empty ledger

- **WHEN** a task has no `execution-ledger.json`
- **THEN** loading it returns `{ version: 1, taskId, requirements: {}, processedEventIds: [], ignoredEvents: 0 }`

#### Scenario: Corrupt ledger fails loud

- **WHEN** `execution-ledger.json` contains invalid JSON
- **THEN** loading throws an error naming the file and does not return partial state

#### Scenario: Persistence round-trip

- **WHEN** a ledger is saved and loaded again
- **THEN** the loaded ledger is deeply equal to the saved ledger

### Requirement: Idempotent event application

`applyEvents(ledger, events)` SHALL be pure, SHALL NOT mutate its inputs, SHALL ignore
already-processed event ids, and SHALL count unknown or malformed events in
`ignoredEvents` without throwing.

#### Scenario: Replaying the same events

- **WHEN** the same event list is applied twice
- **THEN** actions, observations and evidence are not duplicated

#### Scenario: Malformed event

- **WHEN** an event lacks `id`, `type` or a timestamp
- **THEN** it is skipped and `ignoredEvents` increments

### Requirement: Reuse the requirement transition table

The ledger SHALL drive requirement status through the existing `VALID_TRANSITIONS` /
`canTransition` from `src/verification/verification-model.js` and SHALL NOT reimplement the
transition table.

#### Scenario: Full verification sequence

- **WHEN** CLAIM_CREATED, ACTION_STARTED, OBSERVATION_CREATED, EVIDENCE_ADDED,
  VERIFICATION_STARTED and VERIFICATION_COMPLETED are applied in order
- **THEN** the requirement status is `VERIFIED`

#### Scenario: Illegal jump is rejected

- **WHEN** VERIFICATION_COMPLETED is applied to a requirement still in `OPEN`
- **THEN** the status remains `OPEN` and the rejection is recorded as a decision

### Requirement: Deterministic projection

`projectExecution(ledger)` SHALL return a deterministic, sorted projection with
`taskId`, `requirements`, `pendingObligations` and `conflicts`. Obligations SHALL be derived
from non-VERIFIED requirements and open evidence conflicts.

#### Scenario: Conflict blocks completion

- **WHEN** a requirement has an unresolved evidence conflict
- **THEN** the conflict appears in `projectExecution().conflicts`, the requirement is not
  `VERIFIED`, and its obligation reason is `unresolved evidence conflict`

#### Scenario: Verified requirements have no obligations

- **WHEN** all requirements are `VERIFIED`
- **THEN** `pendingObligations` is empty

### Requirement: No free-text state override

The module SHALL NOT expose a function that accepts a free-text summary to overwrite
execution state, and this change SHALL NOT modify `context-compaction.js`, the compaction
hook, `assembly.js`, `context.js` or the router.

#### Scenario: Compaction cannot rewrite state

- **WHEN** compaction output is produced
- **THEN** it has no code path into the execution ledger in this phase
