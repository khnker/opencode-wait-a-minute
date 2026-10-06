# No-Regression Thresholds

## ADDED Requirements

### Requirement: No-Regression Thresholds
RC1 MUST gate on correctness, state equivalence and deterministic savings thresholds, and MUST NOT gate on live-provider savings variance.

#### Scenario: Thresholds enforced
- **WHEN** regression occurs
- **THEN** the gate fails


#### Scenario: Live variance tolerated
- **WHEN** live-provider savings vary
- **THEN** the release is not blocked solely by that variance

