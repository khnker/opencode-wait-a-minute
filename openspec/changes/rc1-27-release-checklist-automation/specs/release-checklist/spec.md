# Release Checklist Automation

## ADDED Requirements

### Requirement: Release Checklist Automation
A single command MUST evaluate every RC1 gate and emit a machine-readable READY/BLOCKED verdict.

#### Scenario: All-green yields READY
- **WHEN** every mandatory gate passes
- **THEN** the summary prints RC1 READY and exits 0

#### Scenario: Any failure yields BLOCKED
- **WHEN** a mandatory gate fails
- **THEN** the summary prints RC1 BLOCKED with the blockers
