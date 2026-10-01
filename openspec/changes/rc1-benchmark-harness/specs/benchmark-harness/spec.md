# Benchmark Harness Spec

## ADDED Requirements

### Requirement: Reproducible Harness
The system MUST provide reproducible baseline and WAM experiment runners.

#### Scenario: Running dry-run benchmark
- GIVEN a benchmark runner with mock provider
- WHEN running dry-run
- THEN comparable metrics are produced without external network calls.
