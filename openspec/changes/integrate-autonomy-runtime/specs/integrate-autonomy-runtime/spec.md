# Design: Integrate Autonomy Runtime

## ADDED Requirements
### Requirement: Cognitive Context Injection
The assembly layer MUST load cognitive state from `.wam/task/cognition.json` and inject a compact version as a `[wam N2 cognition]` block, emitting zero lines when no cognition exists.
#### Scenario: Empty cognition injects nothing
- **WHEN** no cognitive state file exists
- **THEN** the assembly emits zero cognition lines
### Requirement: Risk Hardening Integration
The risk engine MUST expose a structured `WamPolicyBlock` error class, canonicalize paths via `node:path.resolve` plus `path.relative`, and classify the `task` action as GUARDED.
#### Scenario: Path canonicalization applied
- **WHEN** the risk engine evaluates a path-bearing action
- **THEN** the path is canonicalized with node:path.resolve and path.relative before classification
### Requirement: Cognitive Memory Persistence
A `cognitive-state.js` persistence layer MUST persist active and rejected hypotheses and compact them under a byte budget.
#### Scenario: Memory compacted under byte budget
- **WHEN** persisted cognitive state exceeds the byte budget
- **THEN** it is compacted while retaining active and rejected hypotheses
### Requirement: Autonomy Integration Tests
Integration tests in `autonomy-behavioral.test.mjs` MUST cover the 15 behavioral autonomy-matrix scenarios.
#### Scenario: Fifteen behavioral tests present
- **WHEN** the autonomy integration tests run
- **THEN** all 15 behavioral scenarios of the autonomy matrix are exercised