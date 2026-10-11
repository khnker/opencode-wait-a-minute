# spec: wam-state-validation

## ADDED Requirements

### Requirement: State Transition Validation
The WAM system MUST validate all state transitions to prevent inconsistent states.

#### Scenario: Validation Enforcement
- **WHEN** a state transition is requested
- **THEN** the State Validator evaluates the request against retention and compliance rules
- **AND** invalid transitions are rejected with an error.

## Scope
WAM State Machine transitions.

## Invariants
1. **Compliance:** All transitions MUST adhere to defined retention and state policies.
2. **Integrity:** Invalid transitions MUST be rejected immediately.
3. **Audit:** All validation attempts MUST be logged.

## Hooks
- `validateTransition(fromState, toState)`: Enforces rules before allowing a state change.
