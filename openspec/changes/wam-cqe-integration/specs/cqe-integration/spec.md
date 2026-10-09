# CQE Integration Contract

## ADDED Requirements

### Requirement: Non-Side-Effectful Library Import
The CQE core engine MUST be importable as a Node.js ESM module without executing searches, spawning background servers, or mutating global state upon import.

#### Scenario: Import does not trigger retrieval
- **WHEN** WAM imports the CQE core module
- **THEN** no search is executed, no process is spawned, and no file is written

#### Scenario: Instance creation is inert
- **WHEN** `createEngine(config)` is called
- **THEN** the target repository is not modified and no query runs until `query()` is invoked

### Requirement: Repository Isolation
Engine instances MUST operate on explicitly configured repository paths, isolating caches, indices, and temporary files per repository without relying on global `process.cwd()`.

#### Scenario: Two repositories do not share results
- **WHEN** two engines target different repositories
- **THEN** queries never return results or cache entries belonging to the other repository

#### Scenario: Path resolution from a foreign cwd
- **WHEN** the engine runs from a working directory other than CQE's root
- **THEN** scripts, indices, and caches resolve against the configured repository

### Requirement: Structured Provenance & Results
Retrieval results MUST include provenance metadata (relative file path, line range, snippet, operator, query, cost/token estimates, execution status) and distinguish deterministic matches from probabilistic scoring.

#### Scenario: Provenance preserved
- **WHEN** a query returns a result
- **THEN** the result identifies the operator, query, and location that produced it

#### Scenario: Deterministic match survives selection
- **WHEN** probabilistic scoring ranks a deterministic match low
- **THEN** the deterministic match is still reported and not silently dropped

### Requirement: Typed Error Handling & Fallbacks
Failures in CQE execution MUST be represented as typed errors distinguishing empty results from failed operations, so WAM falls back without silent degradation or false verification.

#### Scenario: Failure is not an empty result
- **WHEN** an operator or external tool fails
- **THEN** the response indicates the failure rather than reporting zero matches

#### Scenario: WAM keeps verification authority
- **WHEN** CQE returns successful results
- **THEN** WAM does not transition the task to `VERIFIED` based solely on CQE output
