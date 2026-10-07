# Change: wam-observation-provenance

## ADDED Requirements
### Requirement: Observation Provenance Schema
Every persisted operational observation MUST preserve its provenance with fields: `id`, `statement`, `source`, `sourceType`, `confidence`, `observedAt`, `validUntil`, and `status`.
#### Scenario: Observation persisted with provenance
- **WHEN** an operational observation is persisted
- **THEN** it retains id, statement, source, sourceType, confidence, observedAt, validUntil, and status
### Requirement: Source Type Enumeration
`sourceType` MUST be one of `COMMAND`, `FILE`, `TEST`, `TOOL`, `USER`, or `AGENT_INFERENCE`.
#### Scenario: Invalid source type rejected
- **WHEN** an observation is created with a sourceType outside the defined enumeration
- **THEN** it is rejected
### Requirement: Inference Cannot Become Known Automatically
An observation with sourceType `AGENT_INFERENCE` MUST NOT be automatically converted to KNOWN.
#### Scenario: AGENT_INFERENCE stays inferred
- **WHEN** an observation originates from agent inference
- **THEN** it is not automatically promoted to KNOWN
### Requirement: Lineage Preservation
An observation derived from another observation MUST preserve lineage.
#### Scenario: Derived observation keeps lineage
- **WHEN** an observation is derived from a prior observation
- **THEN** the derived observation retains lineage to its source observation