# Full E2E Lifecycle

## ADDED Requirements

### Requirement: Full E2E Lifecycle
The E2E suite MUST assert every lifecycle stage from prompt to done.

#### Scenario: Lifecycle completes
- **WHEN** a controlled prompt is executed
- **THEN** each stage emits its signal
