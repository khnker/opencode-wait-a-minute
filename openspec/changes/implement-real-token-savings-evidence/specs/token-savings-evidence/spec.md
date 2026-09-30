# Specification: Token Savings Evidence

## ADDED Requirements

### Requirement: Real execution data

The benchmark MUST derive token measurements from captured execution data.

#### Scenario: Trace produces measurements
- **WHEN** the deterministic runner replays recorded traces
- **THEN** token measurements are derived from those traces and no scenario constant is used as a measurement

### Requirement: Provider usage

When provider token usage is available, it MUST be used as the authoritative measurement.

#### Scenario: Provider reports usage
- **WHEN** a run captures provider token usage
- **THEN** that usage is recorded as the authoritative measurement

### Requirement: Tokenizer fallback

When provider usage is unavailable, the benchmark MUST calculate tokens from captured request content using a declared tokenizer.

#### Scenario: Provider usage missing
- **WHEN** a run has no provider token usage
- **THEN** tokens are calculated from captured request content with a declared tokenizer

### Requirement: Negative savings

Negative savings MUST be preserved.

The implementation MUST NOT clamp negative savings.

#### Scenario: WAM consumes more tokens
- **WHEN** a WAM sample uses more tokens than its baseline
- **THEN** the negative savings value is reported unchanged

### Requirement: Verified completion

Every benchmark run MUST record whether the expected work was verified.

#### Scenario: Expected work checked
- **WHEN** a sample completes
- **THEN** the run records whether the scenario's expected work was verified

### Requirement: Provenance

Every run MUST record:

* actual Git SHA
* dirty-tree state
* benchmark version
* scenario version
* runner version
* analyzer version

#### Scenario: Provenance recorded
- **WHEN** a benchmark run writes its evidence
- **THEN** it records the actual Git SHA, dirty-tree state and the benchmark, scenario, runner and analyzer versions

### Requirement: Paired execution

Baseline and WAM runs MUST use equivalent benchmark conditions.

#### Scenario: Equivalent conditions
- **WHEN** baseline and WAM samples are produced
- **THEN** both use equivalent benchmark conditions

### Requirement: Repeated execution

Real-model execution MUST support at least five paired runs.

#### Scenario: Five paired runs
- **WHEN** real-model execution is enabled
- **THEN** at least five paired baseline/WAM runs are supported

### Requirement: Statistical summary

Repeated runs MUST expose:

* minimum
* p25
* median
* p75
* maximum

#### Scenario: Repeated results summarized
- **WHEN** repeated runs are summarized
- **THEN** minimum, p25, median, p75 and maximum are exposed

### Requirement: Raw evidence

Raw execution evidence MUST be persisted independently of generated reports.

#### Scenario: Raw evidence persisted
- **WHEN** a run completes
- **THEN** raw execution evidence is written independently of generated reports

### Requirement: Claims classification

Measurements MUST identify whether they are observed, measured, derived or estimated.

#### Scenario: Measurement classified
- **WHEN** a measurement is reported
- **THEN** it is identified as observed, measured, derived or estimated

### Requirement: Deterministic replay

Deterministic replay MUST be network independent and reproducible.

#### Scenario: Offline replay
- **WHEN** the deterministic runner executes
- **THEN** it requires no network and reproduces the same results

### Requirement: Real-model opt-in

Real-model execution MUST NOT be required by the normal test suite.

#### Scenario: Default test suite
- **WHEN** the normal test suite runs
- **THEN** real-model execution is not required

### Requirement: No forced positive result

Tests MUST NOT require WAM to produce positive token savings for every scenario.

#### Scenario: Negative scenario allowed
- **WHEN** tests evaluate benchmark scenarios
- **THEN** they do not require positive token savings for every scenario
