# Spec: Delegation governance

## ADDED Requirements

### Requirement: Preflight documentation states the advisory contract

Documentation of the permission preflight MUST describe it as advisory: delegation is
never blocked, the derived permissions are surfaced as a recommendation, and
`/wam permissions approve` / `deny` only update the recorded plan.

#### Scenario: Reader looks up the permission preflight

- **GIVEN** a reader opens the "Runtime controls" section of `README.md`
- **WHEN** they read the permission preflight bullet
- **THEN** it states that delegation is not blocked
- **AND** it does not claim the preflight blocks delegation until permissions are granted
