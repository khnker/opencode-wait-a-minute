# Spec: `/wam ctx get` CQE fallback

## ADDED Requirements

### Requirement: Explicit ctx get queries fall back to CQE

The system MUST query the CQE/native file index when an explicit
`/wam ctx get "<query>"` finds no matching capsules, before reporting that no
context is available. Capsule results MUST take precedence when they exist.
CQE/native results MUST be tagged with their source and MUST NOT be fabricated
when both sources are empty.

#### Scenario: Fresh project with CQE matches

- **GIVEN** a project with no `.wam/capsules` entries
- **AND** a file containing the queried token
- **WHEN** `/wam ctx get "<token>"` runs
- **THEN** it returns CQE/native items for that file
- **AND** each item is tagged `[cqe]` or `[wam-native]`
- **AND** the result is bounded to at most five items

#### Scenario: Capsules take precedence

- **GIVEN** an active capsule matching the query
- **WHEN** `/wam ctx get "<query>"` runs
- **THEN** the existing capsule output format is returned
- **AND** CQE is not used as the result source

#### Scenario: Both sources empty

- **GIVEN** no matching capsules
- **AND** no CQE/native matches or a CQE failure
- **WHEN** `/wam ctx get "<query>"` runs
- **THEN** it returns the existing capsule failure message
- **AND** no items are fabricated
- **AND** the command does not throw
