# WAM Router Admission Invariants

## ADDED Requirements

### Requirement: Node admission invariant
The `Admission` class MUST ensure that all MANDATORY nodes are present before allowing execution to continue, defined as "execution cannot safely proceed without this node."

#### Scenario: Mandatory node missing (via Precedence)
- **WHEN** a request for execution is received
- **AND** a node with a higher-precedence mandatory requirement is missing
- **THEN** the `Admission` class MUST reject the request, regardless of lower-precedence node types present

### Requirement: Admission precedence
Admission decisions MUST follow this hierarchy (1 highest, 6 lowest):

1. Execution dependency
2. Completion dependency
3. Evidence required for verification
4. Decision required
5. Conditional support
6. Optional context

#### Scenario: Precedence enforced
- **WHEN** multiple nodes with different precedence levels are present
- **THEN** higher-precedence nodes MUST be satisfied first
- **AND** lower-precedence nodes MUST wait for higher-precedence dependencies