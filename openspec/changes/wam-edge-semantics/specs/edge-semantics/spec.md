# WAM Edge Semantics

## ADDED Requirements

### Requirement: Canonical edge validation
The `ContextGraph.addEdge()` function MUST validate that the edge type is one of the canonical types defined in `EDGE_TYPES`.

#### Scenario: Invalid edge rejected
- **WHEN** `ContextGraph.addEdge()` is called with a non-canonical edge type
- **THEN** the edge MUST throw an error or be rejected

### Requirement: Directionality enforcement
Edges MUST have clear directionality defined in the graph traversal.

#### Scenario: Canonical traversal semantics
- **WHEN** `getUpstream` or `getDownstream` traverses the graph
- **THEN** it MUST follow canonical semantics

#### Scenario: Compatibility validated at creation
- **WHEN** an edge is created
- **THEN** source/target compatibility MUST be validated

### Requirement: Legacy compatibility
Existing graphs with non-canonical edge types (e.g., `depends_on`) MUST be flagged or rejected.

#### Scenario: Migration path defined
- **WHEN** a graph contains a legacy non-canonical edge type
- **THEN** a migration path or validation rule MUST be defined
