# Human Extensibility Contracts

## ADDED Requirements

### Requirement: Explicit Extension Contracts
Every justified extension point MUST have an explicit contract defining input, output, failure behavior, lifecycle, side effects, ownership and registration.

#### Scenario: Contract is complete
- **WHEN** an extension point is documented
- **THEN** its contract specifies input, output, failure, lifecycle and registration

#### Scenario: New capability added independently
- **WHEN** a developer implements the documented contract and registers the capability
- **THEN** no unrelated business logic needs to change

### Requirement: Registration and Execution Separation
Capability registration ("what exists") MUST be separable from execution selection ("what runs now") where variation is recurring.

#### Scenario: Discovery is explicit
- **WHEN** capabilities are registered
- **THEN** they are discoverable without inspecting unrelated orchestration internals
