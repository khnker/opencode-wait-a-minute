# Real OpenCode E2E Harness

## ADDED Requirements

### Requirement: Real OpenCode E2E Harness
The E2E harness MUST exercise the published artifact inside a real OpenCode instance and emit a machine-readable summary.

#### Scenario: Harness runs against real artifact
- **WHEN** the E2E suite runs
- **THEN** the plugin is loaded from the packed artifact in a real OpenCode instance
