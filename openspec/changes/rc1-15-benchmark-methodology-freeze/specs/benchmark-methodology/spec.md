# Benchmark Methodology Freeze

## ADDED Requirements

### Requirement: Benchmark Methodology Freeze
Deterministic and live-provider benchmark results MUST be separated and MUST carry full provenance.

#### Scenario: Separation holds
- **WHEN** benchmark results are produced
- **THEN** deterministic and live figures are never merged


#### Scenario: Provenance present
- **WHEN** a result is emitted
- **THEN** it contains commit, version, scenario, token fields, equivalent and provider/model when applicable

