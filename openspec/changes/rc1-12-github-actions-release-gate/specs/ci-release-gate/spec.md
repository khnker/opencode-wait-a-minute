# GitHub Actions Release Gate

## ADDED Requirements

### Requirement: GitHub Actions Release Gate
CI workflows MUST enforce the mandatory RC1 gates automatically.

#### Scenario: CI enforces gates
- **WHEN** a change is proposed or a release is tagged
- **THEN** the workflows run the mandatory gates
