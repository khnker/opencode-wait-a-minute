# Assumption / Decision-Critical Gate

## ADDED Requirements

### Requirement: Assumption / Decision-Critical Gate
WAM MUST block continuation when an unknown assumption is decision-critical and MUST proceed when it is not.

#### Scenario: Critical unknown blocks
- **WHEN** an unknown assumption drives a decision
- **THEN** continuation is blocked

#### Scenario: Non-critical unknown proceeds
- **WHEN** an unknown assumption is not decision-critical
- **THEN** execution continues
