# continuity-comparative-benchmark Specification

## Purpose
TBD - created by archiving change add-continuity-comparative-benchmark. Update Purpose after archive.
## Requirements
### Requirement: Three-strategy continuity comparison

The repository SHALL provide a deterministic benchmark that builds one fixture
with the production ledger, canonical-delta, decision and task-hierarchy
modules and evaluates `full`, `top-k` and `wam` strategies under the same
4000-character budget. Every strategy SHALL derive its content from the same
ledger, canonical base and decisions. The benchmark SHALL NOT change production
behaviour.

#### Scenario: WAM preserves all continuity probes

- **WHEN** the benchmark builds the WAM brief for the fixture
- **THEN** it SHALL score 10/10 continuity probes with zero mandatory
  constraints lost

#### Scenario: Naive strategies lose status-aware information

- **WHEN** the benchmark evaluates `full` and `top-k`
- **THEN** each SHALL fail at least one deliberate failure case, and WAM SHALL
  be a strict superset of both on the status-aware probes (superseded decision,
  hypothesis, invalidated fact)

#### Scenario: Large state exposes the truncation trade-off

- **WHEN** the benchmark runs the same strategies against the large-state
  fixture (60 requirements, 40 decisions, 40 canonical entries) under the same
  4000-character budget
- **THEN** `full` SHALL truncate at the budget and lose the pending requirement
  and at least one status-aware probe, while `wam` SHALL stay within budget with
  10/10 probes, zero mandatory loss and identical text after restart

### Requirement: Honest token accounting

The benchmark SHALL report `briefTokens`, `recoveryTokens`, `totalTokens`,
`mandatoryLost` and informational `selectMs` for every strategy, with
`totalTokens` equal to `briefTokens + recoveryTokens`.

#### Scenario: Total tokens include recovery

- **WHEN** a strategy omits a stored detail but references it
- **THEN** the tokens of the detail loaded during recovery SHALL be added to
  its total, so a smaller brief cannot win by silently dropping facts

### Requirement: Restart determinism

Loading the fixture twice from disk SHALL produce byte-identical brief text for
every strategy.

#### Scenario: Independent reloads match

- **WHEN** the benchmark reloads the task, ledger and canonical base and
  rebuilds a brief
- **THEN** the rebuilt text SHALL equal the first-run text

