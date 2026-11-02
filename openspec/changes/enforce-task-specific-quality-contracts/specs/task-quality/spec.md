# Task Quality Sufficiency

## ADDED Requirements

### Requirement: Task-kind quality profiles

WAM SHALL provide deterministic default evidence profiles for research,
implementation, debugging, refactoring, review and documentation tasks, and MUST
treat the task kind as metadata that supplies defaults rather than as authority
over explicit criterion requirements.

#### Scenario: Kind supplies defaults

- **WHEN** a task declares `kind: debugging` and a criterion has no explicit
  `evidenceRequirements`
- **THEN** the resolved contract requires a reproduction and a resolution test
  for that criterion

#### Scenario: Criterion overrides kind

- **WHEN** a criterion declares its own `evidenceRequirements`
- **THEN** the kind profile does not remove or weaken them

#### Scenario: Unknown kind

- **WHEN** the task kind is missing or unknown
- **THEN** no kind-specific evidence is invented and only criterion-level
  requirements apply

### Requirement: Evidence sufficiency evaluation

WAM SHALL evaluate evidence sufficiency as a pure function of the contract,
evidence and an explicit `now`, and MUST return deterministic reasons for every
gap.

#### Scenario: Weak evidence is insufficient

- **WHEN** a mandatory criterion is supported only by `L0_CLAIM` or
  `L1_INFERENCE` evidence
- **THEN** the evaluator reports the criterion as insufficient and names the
  missing evidence type and strength

#### Scenario: Sufficient evidence passes

- **WHEN** every mandatory criterion has its required evidence types at or above
  the required strength and count
- **THEN** the evaluator reports `sufficient: true`

#### Scenario: Malformed evidence

- **WHEN** an evidence item is malformed
- **THEN** the evaluator reports it as a reason and does not throw

### Requirement: Stale evidence detection

WAM SHALL detect evidence that no longer refers to the current artifact and MUST
report it separately from missing evidence.

#### Scenario: Artifact changed after evidence

- **WHEN** an evidence item's `sourceRef` hash differs from the current artifact
  hash
- **THEN** the evidence is reported as stale

#### Scenario: Maximum age exceeded

- **WHEN** `maxAgeMs` is configured and the evidence timestamp is older than
  `now - maxAgeMs`
- **THEN** the evidence is reported as stale

### Requirement: Contradiction detection

WAM SHALL detect contradictory evidence and MUST route contradictions to
replanning instead of accepting the task.

#### Scenario: Failed evidence against a satisfied criterion

- **WHEN** a criterion has a `FAILED` verdict and is also marked satisfied
- **THEN** the evaluator reports a contradiction for that criterion

#### Scenario: Conflicting hashes without supersession

- **WHEN** two evidence items reference the same `sourceRef` with different
  hashes and neither supersedes the other
- **THEN** the evaluator reports a contradiction

### Requirement: Completion gate integration

WAM SHALL integrate quality sufficiency into the completion gate only when
`qualityContracts.enabled` is true, and MUST leave behavior unchanged when the
flag is false.

#### Scenario: Flag disabled

- **WHEN** `qualityContracts.enabled` is false
- **THEN** the completion gate produces the same result as before this change

#### Scenario: Insufficient quality blocks completion

- **WHEN** the flag is true and the evaluator reports `sufficient: false`
- **THEN** the task cannot be reported complete and the pending reasons are
  surfaced

#### Scenario: Contradiction triggers replanning

- **WHEN** the flag is true and the evaluator reports a contradiction
- **THEN** the loop decision is `REPLAN`, not `COMPLETE`

### Requirement: Quality observability

WAM SHALL emit a deterministic `quality.evaluated` record for every evaluation
so the autonomy benchmark can compute false acceptance and false block rates.

#### Scenario: Evaluation record

- **WHEN** an evaluation runs
- **THEN** a record includes task id, kind, sufficient flag, missing count,
  stale count, contradiction count and the reason codes
