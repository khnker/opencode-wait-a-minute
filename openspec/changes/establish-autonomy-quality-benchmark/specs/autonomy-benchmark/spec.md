# Autonomy Quality Benchmark

## ADDED Requirements

### Requirement: Canonical run record

WAM SHALL record every autonomy benchmark run using the versioned
`wam.autonomy.benchmark/1` schema, and the record MUST be derived from
persisted events rather than from agent self-report.

#### Scenario: Complete record

- **WHEN** a task finishes under any configuration
- **THEN** the record includes config id, task id and kind, model, WAM flags,
  tokens, iterations, decision counts, outcome, quality, review and context
  metrics

#### Scenario: Missing event

- **WHEN** a required metric cannot be derived from events
- **THEN** the record marks it as unavailable instead of inventing a value

### Requirement: Four-configuration matrix

The benchmark SHALL support exactly these configurations so gains can be
attributed to specific WAM capabilities.

#### Scenario: Configuration selection

- **WHEN** the runner is invoked with a configuration id
- **THEN** it runs only with the features enabled for that configuration, from
  `opencode-no-wam` through `wam-full`

### Requirement: Fair comparison

The benchmark SHALL compare configurations using the same task set, model
version, tool permissions, token budget, iteration budget and seed.

#### Scenario: Confounded run rejected

- **WHEN** two configurations differ in model version or budget
- **THEN** the report rejects the comparison instead of publishing a delta

#### Scenario: Paired deltas

- **WHEN** a task runs under multiple configurations
- **THEN** the report computes per-task deltas before aggregating

### Requirement: Metric definitions

The benchmark SHALL compute task success, verified success, review defect
detection, false acceptance, human intervention, recovery, replanning
efficiency, token cost per outcome and context relevance using the documented
definitions.

#### Scenario: False acceptance

- **WHEN** a task is accepted despite a known oracle defect
- **THEN** it counts toward the false acceptance rate, even if the run reports
  success

### Requirement: Deterministic reporting

Reports SHALL be byte-identical across repeated runs of the same inputs.

#### Scenario: Repeat run

- **WHEN** the same records are aggregated twice
- **THEN** the serialized report is identical and contains no timestamps

### Requirement: Ablation attribution

The benchmark SHALL support disabling one WAM capability at a time from the full
configuration.

#### Scenario: Single-feature ablation

- **WHEN** the runner executes an ablation
- **THEN** exactly one feature flag differs from `wam-full` and the report labels
  the delta as attributable to that feature
