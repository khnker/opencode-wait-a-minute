## ADDED Requirements

### Requirement: Run Provenance
Every run MUST record reproducible provenance, resolving the actual Git SHA rather than the literal `HEAD`.

#### Scenario: Provenance Recorded
- **WHEN** a run is persisted
- **THEN** it records `runId`, `pairId`, `gitSha`, `gitDirty`, `wamVersion`, `benchmarkVersion`, `scenarioVersion`, `traceSchemaVersion`, `runnerVersion`, `analyzerVersion`, `provider`, `model`, `generationParameters`, and `timestamp`

#### Scenario: Actual Git SHA
- **WHEN** the benchmark resolves the Git revision
- **THEN** it records the resolved SHA and MUST NOT record the literal value `HEAD`

#### Scenario: Dirty Working Tree
- **WHEN** the working tree has uncommitted changes
- **THEN** the run explicitly records the dirty state

### Requirement: Evidence Reproducibility
The benchmark MUST produce reproducible evidence artifacts whose analysis is stable.

#### Scenario: Artifacts Generated
- **WHEN** the benchmark completes
- **THEN** it generates `raw.json`, `summary.json`, `report.md`, and `charts/`

#### Scenario: Derivable Summary
- **WHEN** the summary or report is produced
- **THEN** it is derivable from `raw.json`

#### Scenario: Stable Analysis
- **WHEN** the analyzer is re-run against the same raw evidence
- **THEN** it produces equivalent metrics

#### Scenario: Non-Deterministic Execution
- **WHEN** real-model execution is described
- **THEN** it is NOT described as byte-for-byte reproducible; the reproducible artifact is the captured evidence and its analysis
