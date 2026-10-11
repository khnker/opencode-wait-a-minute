# ci-release-gate Specification

## Purpose
TBD - created by archiving change rc1-12-github-actions-release-gate. Update Purpose after archive.
## Requirements
### Requirement: GitHub Actions Release Gate
CI workflows MUST enforce the mandatory RC1 gates automatically.

#### Scenario: CI enforces gates
- **WHEN** a change is proposed or a release is tagged
- **THEN** the workflows run the mandatory gates

