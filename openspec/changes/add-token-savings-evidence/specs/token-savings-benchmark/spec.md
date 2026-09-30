# Token Savings Benchmark Specification

## Requirement: Benchmark runs must be comparable

A baseline and WAM execution for the same scenario MUST use equivalent initial conditions.

### Scenario: Identical scenario

* GIVEN a benchmark scenario
* WHEN baseline and WAM executions are created
* THEN they MUST use the same scenario definition
* AND the same initial repository state
* AND equivalent model configuration

---

## Requirement: Token usage must be recorded

Every completed benchmark run MUST record input, output and total token usage when available.

### Scenario: Provider token usage available

* GIVEN the provider reports token usage
* WHEN the run completes
* THEN the benchmark MUST use the provider-reported values
* AND identify the measurement source as `provider`

### Scenario: Provider token usage unavailable

* GIVEN provider usage is unavailable
* WHEN the run completes
* THEN the benchmark MAY estimate token usage
* AND MUST identify the measurement source as `estimator`

---

## Requirement: Token savings must preserve negative results

The benchmark MUST report negative savings when WAM consumes more tokens than baseline.

### Scenario: WAM overhead

* GIVEN baseline uses fewer tokens than WAM
* WHEN savings are calculated
* THEN the savings value MUST be negative
* AND MUST NOT be clamped to zero

---

## Requirement: Verified progress must accompany token measurements

A benchmark MUST record whether the task reached verified completion.

### Scenario: Lower tokens but failed task

* GIVEN WAM consumes fewer tokens than baseline
* AND WAM fails verification
* WHEN efficiency is calculated
* THEN the report MUST preserve the failed completion status
* AND MUST NOT represent the run as a successful efficiency improvement

---

## Requirement: Deterministic benchmark must be CI-compatible

The deterministic benchmark MUST execute without external model credentials.

### Scenario: CI execution

* GIVEN a clean checkout
* WHEN the deterministic token benchmark runs
* THEN it MUST execute without an external LLM provider
* AND MUST produce machine-readable results

---

## Requirement: Real-model benchmark must be explicitly opt-in

Real-model execution MUST NOT run as part of the default test suite.

### Scenario: Missing provider credentials

* GIVEN real-model benchmarking is requested
* AND provider credentials are unavailable
* WHEN the benchmark starts
* THEN it MUST fail clearly
* AND MUST NOT silently execute the deterministic benchmark instead

---

## Requirement: Graphs must derive from benchmark evidence

Generated graphs MUST be produced from machine-readable benchmark output.

### Scenario: Rebuild report

* GIVEN a valid benchmark result
* WHEN report generation runs
* THEN the graph values MUST correspond to the source JSON
* AND manually entered graph values MUST NOT be required

---

## Requirement: Real-model results must expose variance

When multiple real-model runs exist, the report MUST expose distribution information.

At minimum:

```text
minimum
p25
median
p75
maximum
```

must be available for the primary token metrics.

---

## Requirement: Benchmark provenance must be recorded

Every benchmark result MUST include:

* benchmark version;
* git commit;
* scenario;
* execution mode;
* timestamp;
* model identifier when applicable.

---

## Requirement: Deterministic regressions must be detectable

The deterministic benchmark MUST support comparison against a stored reference result.

A configurable regression threshold MUST be available.

A regression beyond the configured threshold MUST cause the benchmark command to fail.

---

## Requirement: Heuristic audit output must remain separate

Token-savings evidence MUST NOT depend on heuristic classifications from `wam-audit`.

Audit classifications MAY be included as metadata but MUST NOT determine token savings.
