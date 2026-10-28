## ADDED Requirements

### Requirement: Semantic continuity benchmark

The repository SHALL provide a deterministic benchmark that builds one fixture
with the production ledger, canonical-delta, retention and task-hierarchy
modules and scores the legacy context brief and the semantic projection against
the same eight continuity probes under the same 4000-character budget.

#### Scenario: Projection preserves continuity

- **WHEN** the benchmark builds the legacy brief and the semantic projection
  for the same task, decisions and entities
- **THEN** the projection SHALL score 8/8 and strictly higher than the legacy
  brief

#### Scenario: Total tokens include recovery

- **WHEN** the benchmark counts the tokens needed for detail that the brief
  omits but points to
- **THEN** brief tokens plus recovery tokens SHALL stay within the 4000-
  character budget

#### Scenario: Deterministic and restart-safe

- **WHEN** the projection is rebuilt either twice in memory or from a fresh
  load of the ledger and canonical base on disk
- **THEN** the rendered output SHALL be identical

#### Scenario: Task isolation

- **WHEN** a projection is built for a sibling task
- **THEN** it SHALL NOT contain the first task's requirement ids, and the first
  task's projection SHALL NOT contain the sibling's secret term

#### Scenario: Consolidated group summary

- **WHEN** a task is consolidated into its parent group
- **THEN** the group projection SHALL surface the consolidated summary and the
  sibling projection SHALL NOT
