# Design: Context Decision Trace

## ADDED Requirements
### Requirement: Context Decision Trace
The system MUST make every context admission decision explainable by tracing source (how the node was discovered), dependency path (chain of dependencies leading to inclusion), admission class (MANDATORY/CONDITIONAL/OPTIONAL), relevance score, token cost, and final assembly level (N0-N4).
#### Scenario: Trace captures admission class
- **WHEN** a context node is admitted
- **THEN** the trace records its admission class (MANDATORY/CONDITIONAL/OPTIONAL)
### Requirement: Trace Collection Points
Trace collection MUST occur at key points: during graph traversal in resolveContext(), during admission classification, during budget allocation, and during final assembly formatting.
#### Scenario: Traces collected during graph traversal
- **WHEN** resolveContext() traverses the context graph
- **THEN** traces are emitted for considered nodes
### Requirement: ContextDecisionTrace Type
The system MUST create a ContextDecisionTrace type, modify resolveContext to emit traces for considered nodes, enhance the adapter to preserve and enhance traces, extend assembly to attach final level information, and add a diagnostic endpoint for trace lookup.
#### Scenario: Diagnostic endpoint returns trace
- **WHEN** the diagnostic endpoint is queried for a node's trace
- **THEN** the full trace (source, dependency path, admission class, relevance, token cost, assembly level) is returned