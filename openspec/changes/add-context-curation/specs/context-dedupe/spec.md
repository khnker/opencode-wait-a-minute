# Spec: Context dedupe

## ADDED Requirements

### Requirement: Identical context blocks are injected once

The system MUST skip a context block already injected in the same session.

#### Scenario: Repeated skill block

- **GIVEN** a session that already received a skill block
- **WHEN** the same block is assembled again
- **THEN** it is not injected again

#### Scenario: Critical gate

- **GIVEN** a completion-gate or clarification block
- **WHEN** it is assembled again
- **THEN** it is always injected
