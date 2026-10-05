# RC1 Release Evidence

## ADDED Requirements

### Requirement: Mandatory Real Benchmark for RC1
The real-LLM benchmark (`benchmark:real`) MUST be a required stage for any RC1 evidence gate.

#### Scenario: RC1 Gate composition
- **WHEN** `scripts/release-gate.mjs` executes the RC1 stage
- **THEN** it MUST invoke `benchmarks/run-real.mjs`
- **AND** it MUST fail the gate if the benchmark is skipped or fails.

#### Scenario: No silent exits
- **WHEN** `WAM_BENCH_BASE_URL` is unset in `benchmarks/run-real.mjs`
- **THEN** the script MUST exit with a non-zero error code
- **AND** it MUST NOT silently `process.exit(0)`.

### Requirement: Real Runtime Performance Baseline
The `scripts/performance-sanity.mjs` MUST measure actual runtime latencies instead of file existence.

#### Scenario: Performance measurements
- **WHEN** the performance sanity check runs
- **THEN** it MUST measure the following phases: preflight, classification, context assembly, skill routing, continuation fast-path, completion gate, and task persistence.
- **AND** it MUST execute N≥30 trials to calculate median, p95, and p99.

### Requirement: Formalized Savings Metrics
Metrics MUST be reported as three distinct, non-ambiguous values.

#### Scenario: Metric reporting
- **WHEN** generating RC1 reports
- **THEN** it MUST provide `context_reduction`, `wam_overhead`, and `net_input_savings` separately.
- **AND** it MUST NOT use the ambiguous `TokenReductionPct`.

### Requirement: RC1 Evidence Bundle
A complete evidence bundle MUST be generated in `benchmarks/reports/rc1/`.

#### Scenario: Bundle content
- **WHEN** the RC1 evidence is finalized
- **THEN** the directory MUST contain: `summary.json`, `report.md`, `manifest.json`, and `methodology.md`.
- **AND** each file MUST include the full provenance (commit SHA, provider, model, timestamp, scenarios, turns, trials, baseline tokens, WAM tokens, overhead, net savings, %, latency, invalid comparisons, and limitations).
