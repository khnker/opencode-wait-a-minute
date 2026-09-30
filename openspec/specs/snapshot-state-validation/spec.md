# snapshot-state-validation Specification

## Purpose
TBD - created by archiving change harden-context-efficiency-validation. Update Purpose after archive.
## Requirements
### Requirement: Snapshot Matrix
The benchmark MUST include scenarios covering each snapshot state and its expected behavior.

#### Scenario: VALID State
- **WHEN** no relevant state changed
- **THEN** the snapshot is classified `VALID` and the fast-path executes without an unnecessary context rebuild

#### Scenario: STALE via Git
- **WHEN** the Git revision changed while task state remains valid
- **THEN** the snapshot is classified `STALE` and a partial or required rebuild occurs with no stale context reuse

#### Scenario: STALE via Project Context
- **WHEN** relevant project context changed
- **THEN** the snapshot is classified `STALE` and a project-context rebuild occurs

#### Scenario: INVALID via Task State
- **WHEN** task state changed
- **THEN** the snapshot is classified `INVALID` and a full rebuild occurs

#### Scenario: Invalid Snapshot
- **WHEN** a snapshot is malformed, missing required fields, or incompatible with the current schema
- **THEN** the benchmark safely falls back and does NOT use the fast-path

### Requirement: Mutation Matrix
Scenarios MUST mutate exactly one state dimension at a time to keep invalidations attributable.

#### Scenario: Isolated Mutation
- **WHEN** a scenario mutates `gitRevision`, `relevantFilesHash`, `projectContextHash`, or `taskStateHash`
- **THEN** only that dimension changes

#### Scenario: Unrelated Mutation
- **WHEN** an unrelated dimension changes
- **THEN** the snapshot is NOT unnecessarily invalidated

### Requirement: Fast-Path Correctness
For every `VALID` scenario the benchmark MUST verify correct fast-path behavior.

#### Scenario: VALID Fast-Path
- **WHEN** a snapshot is classified `VALID`
- **THEN** the fast-path executes, live task state is re-emitted, unnecessary full context analysis is NOT performed, and verification remains successful

### Requirement: Invalidation Correctness
For every stale or invalid scenario the benchmark MUST verify correct invalidation behavior.

#### Scenario: Correct Invalidation
- **WHEN** a snapshot is stale or invalid
- **THEN** the expected classification and rebuild scope occur, no stale project context is reused, and final verification succeeds

#### Scenario: False VALID Fails
- **WHEN** a stale or invalid snapshot is classified `VALID`
- **THEN** the benchmark fails

