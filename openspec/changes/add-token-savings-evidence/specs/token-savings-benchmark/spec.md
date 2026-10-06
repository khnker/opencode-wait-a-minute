# Token Savings Benchmark

## ADDED Requirements

### Requirement: Benchmark provenance must be recorded
Every completed benchmark run MUST record input, output and total token usage when available.

#### Scenario: Provider token usage available
- **WHEN** the provider reports token usage
- **THEN** the benchmark MUST use the provider-reported values
- **AND** identify the measurement source as `provider`

#### Scenario: Provider token usage unavailable
- **WHEN** provider usage is unavailable
- **THEN** the benchmark MAY estimate token usage
- **AND** MUST identify the measurement source as `estimator`

### Requirement: Benchmark runs must be comparable
A baseline and WAM execution for the same scenario MUST use equivalent initial conditions.

#### Scenario: Identical scenario
- **WHEN** baseline and WAM executions are created
- **THEN** they MUST use the same scenario definition
- **AND** the same initial repository state
- **AND** equivalent model configuration

### Requirement: Token savings must preserve negative results
The benchmark MUST report negative savings when WAM consumes more tokens than baseline.

#### Scenario: WAM overhead
- **WHEN** baseline uses fewer tokens than WAM
- **THEN** the savings value MUST be negative
- **AND** MUST NOT be clamped to zero

### Requirement: Verified progress must accompany token measurements
A benchmark MUST record whether the task reached verified completion.

#### Scenario: Lower tokens but failed task
- **WHEN** WAM consumes fewer tokens than baseline
- **AND** WAM fails verification
- **THEN** the report MUST preserve the failed completion status
- **AND** MUST NOT represent the run as a successful efficiency improvement

### Requirement: Deterministic regressions must be detectable
Benchmark comparisons MUST be deterministic so that regressions can be reliably detected.

#### Scenario: Deterministic comparison
- **WHEN** benchmark results are compared multiple times
- **THEN** the comparison result MUST be the same each time

### Requirement: Real-model results must expose variance
When running real models, the benchmark MUST expose the variance between runs to ensure reproducibility.

#### Scenario: Variance exposure
- **WHEN** real-model benchmarks run multiple times
- **THEN** the results MUST include variance measurements
