## ADDED Requirements

### Requirement: Workload Matrix
The benchmark MUST include four workload families covering the efficiency envelope.

#### Scenario: Local Workload
- **WHEN** small tasks with minimal context are executed
- **THEN** the benchmark measures WAM fixed overhead

#### Scenario: Contextual Workload
- **WHEN** tasks requiring project/domain context are executed
- **THEN** the benchmark measures selective assembly

#### Scenario: Continuation Workload
- **WHEN** multi-turn tasks with repeated context requests are executed
- **THEN** the benchmark measures snapshot fast-path and avoided rebuilds

#### Scenario: Negative Workload
- **WHEN** tasks where WAM overhead exceeds context savings are executed
- **THEN** the benchmark preserves the negative results

### Requirement: Continuation Scaling
The benchmark MUST vary the number of turns in the continuation workload to observe the relationship between avoided rebuilds and reduced context consumption.

#### Scenario: Turn Scaling
- **WHEN** continuation scenarios are generated
- **THEN** turn counts include `1`, `3`, `5`, `10`, and `20`

### Requirement: Causal Metrics
Every scenario MUST expose causal metrics, and the report SHOULD expose derived ratios.

#### Scenario: Per-Scenario Metrics
- **WHEN** a scenario completes
- **THEN** it exposes `turns`, `contextRebuilds`, `fastPathCount`, `partialRebuildCount`, `fullRebuildCount`, `inputTokens`, `outputTokens`, `totalTokens`, and `verification`

#### Scenario: Derived Report Metrics
- **WHEN** the report is generated
- **THEN** it exposes tokens per rebuild, tokens per verified task, rebuild reduction %, input reduction %, and total reduction %
