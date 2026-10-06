# Completion Gate Adversarial Cases

## ADDED Requirements

### Requirement: Completion Gate Adversarial Cases
The completion gate MUST NOT grant completion on claim alone; missing evidence or required actions MUST yield NOT VERIFIED.

#### Scenario: Claim without evidence is rejected
- **WHEN** the agent claims done with no evidence
- **THEN** the gate returns NOT VERIFIED

#### Scenario: Claim without action is rejected
- **WHEN** the agent claims done with a required action missing
- **THEN** the gate returns NOT VERIFIED
