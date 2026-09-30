## ADDED Requirements

### Requirement: Metric Calculation
The framework MUST calculate performance metrics, including token reduction percentage and tokens per successful task.

#### Scenario: Metrics Generation
- **WHEN** benchmark results are analyzed
- **THEN** a `summary.json` is produced containing `TokenReductionPct` and `TokensPerSuccessfulTask`
