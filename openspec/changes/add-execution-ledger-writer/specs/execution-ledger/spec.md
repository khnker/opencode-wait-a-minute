## ADDED Requirements

### Requirement: Production ledger writer

The system SHALL write the per-task execution ledger from explicit task-state
transitions, using only typed events applied through `applyEvents`.

#### Scenario: Contract approval seeds requirements

- **WHEN** a contract with requirements is approved
- **THEN** each requirement id is recorded in the ledger with a `CLAIM_CREATED`
  event and appears in `projectExecution`
- **AND** approving the same contract again adds no duplicate requirement or
  event

#### Scenario: Requirement status is recorded

- **WHEN** a requirement is marked `done` with evidence
- **THEN** the ledger advances it to `SUPPORTED` with an `EVIDENCE_ADDED` entry
- **WHEN** it is then marked `verified`
- **THEN** the ledger reaches `VERIFIED` and reports no pending obligation

#### Scenario: Ledger behind task state catches up

- **WHEN** a requirement is marked `verified` while the ledger still holds it as
  `OPEN`
- **THEN** the writer applies the legal chain up to `VERIFIED`
- **AND** stops without inventing an illegal transition

#### Scenario: Writer failures do not abort the transition

- **WHEN** the ledger cannot be read or written
- **THEN** the task-state change still succeeds and the error is logged

#### Scenario: Contract edit drops stale ledger

- **WHEN** the contract requirements are replaced
- **THEN** the task ledger is removed so projections never mix old and new
  requirement ids
