# Context Graph Reconstruction

## ADDED Requirements

### Requirement: Canonical graph reconstruction
The system MUST provide a unified mechanism to reconstruct the Context Graph from persisted runtime state (Task, Run, Evidence, Dependencies).

#### Scenario: Central reconstruction
- **WHEN** the Context Graph is reconstructed
- **THEN** reconstruction MUST happen centrally, not inside the Router Adapter
- **AND** the resulting graph MUST be an instance of `ContextGraph`

### Requirement: Semantic integrity
The reconstruction MUST preserve all semantic relationships: task dependencies, decision history, evidence lineage, and artifact producers.

#### Scenario: Canonical edges only
- **WHEN** relationships are mapped into the reconstructed graph
- **THEN** all relationships MUST be mapped to the canonical edge types defined in `context-graph.js`
- **AND** no ad-hoc or non-canonical edge types (such as `depends_on`) are allowed in the graph

### Requirement: Determinism
The reconstruction process MUST be deterministic: given the same runtime state, it MUST produce an equivalent `ContextGraph`.

#### Scenario: Stable structure
- **WHEN** the reconstruction runs twice over unchanged runtime state
- **THEN** the graph structure (nodes and edges) MUST be identical across runs

### Requirement: Decoupling
`router-adapter.js` MUST only consume a `ContextGraph` and MUST NOT define graph semantics or perform reconstruction.

#### Scenario: Adapter consumes graph only
- **WHEN** `router-adapter.js` handles a `ContextGraph`
- **THEN** it MUST NOT define graph semantics or perform reconstruction
