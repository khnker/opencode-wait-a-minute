# Benchmark Artifacts

## ADDED Requirements

### Requirement: Benchmark output directory is created on demand

The long-context benchmark MUST create its gitignored results directory before writing an artifact or asserting its availability.

#### Scenario: Clean checkout
- **WHEN** `benchmarks/results/` does not exist
- **THEN** `main()` creates it and writes the JSON artifact
- **AND** the long-context test creates it before running the single-size check
