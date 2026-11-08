# Context Graph Runtime Wiring

## ADDED Requirements

### Requirement: Runtime layers are supplied to graph reconstruction

The system MUST supply the task state, run state, evidence lineage, decisions, observations, hypotheses, experiments, and contract constraints to the context graph builder when it assembles context for a task with persisted runtime state.

#### Scenario: Persisted evidence reaches the graph

- **WHEN** a task has evidence files under its lineage directory
- **THEN** the reconstructed graph MUST contain evidence nodes for that task
- **AND** the N3 context MUST be able to select at least one supporting
  evidence node for a requirement.

### Requirement: Run state is mapped by the canonical builder

`buildContextGraph()` MUST map run-state actions, observations, and decisions
into the canonical `ContextGraph` using canonical node and edge types.

#### Scenario: Run decisions and observations are reconstructed

- **WHEN** a run state contains decisions and observations
- **THEN** the graph MUST contain `decision` and `observation` nodes
- **AND** each node MUST be connected to the task or its requirement.

### Requirement: Causal support for mandatory requirements

The router MUST include supporting evidence and decisions for mandatory
requirements regardless of prompt keyword matching.

#### Scenario: Evidence is not hidden by prompt gating

- **WHEN** a mandatory requirement has an inbound `supports` edge from an
  evidence node
- **AND** the prompt does not mention "evidence" or the evidence text
- **THEN** the evidence node MUST remain a candidate for N3 selection.

#### Scenario: Valid evidence is preferred

- **WHEN** a requirement has both valid and invalid evidence
- **THEN** valid evidence MUST be ordered before invalid evidence
- **AND** the per-requirement cap MUST be respected.

### Requirement: Bounded and deterministic runtime inputs

Runtime inputs MUST be bounded and deterministic.

#### Scenario: Large lineage is capped

- **WHEN** a task has more evidence records than the configured cap
- **THEN** the loader MUST return at most the cap
- **AND** ordering MUST be stable across identical inputs.
