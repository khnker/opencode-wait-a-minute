# Clean Install Smoke Test

## ADDED Requirements

### Requirement: Clean Install Smoke Test
A clean checkout MUST reproduce pack+install+smoke deterministically.

#### Scenario: Clean-room flow passes
- **WHEN** a fresh checkout runs the full flow
- **THEN** every step exits 0 with no local-state dependency
