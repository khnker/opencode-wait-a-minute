# Release Tests

## ADDED Requirements

### Requirement: Release tests do not require developer-only state

Tests run by the release gate MUST pass on a clean checkout without a sibling `context-query-core` checkout or globally installed skills.

#### Scenario: Clean CI checkout
- **WHEN** `npm run gate` runs with no global skills and no sibling checkout
- **THEN** the CQE test uses the vendored engine
- **AND** skill tests skip explicitly when their required skill is unavailable
- **AND** no test fails because of the missing developer state

#### Scenario: Developer machine
- **WHEN** required skills are installed
- **THEN** the skill-routing and skill-audit assertions run unchanged
