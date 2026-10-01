# RC1 Empirical Evidence Plan Spec

## ADDED Requirements

### Requirement: Empirical Evidence Pipeline
The system MUST provide an empirical evidence generation pipeline that separates simulated from observed execution, enforces baseline/WAM state equivalence, integrates verification-based correctness, and produces a reproducible RC1 evidence manifest.

#### Scenario: Running empirical pipeline
- GIVEN a configured OpenAI-compatible provider
- WHEN running the empirical benchmark suite
- THEN observed token usage, state equivalence hashes, verification results, and an RC1 evidence manifest are produced.
