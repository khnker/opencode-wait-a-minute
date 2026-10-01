# Release Gate

## ADDED Requirements

### Requirement: Single Release Gate Command
A single command (`npm run rc1`) MUST compose the release gate stages: unit tests, deterministic validation, deterministic benchmark, package verification, `npm pack`, fresh-install smoke, the real benchmark, and evidence validation.

#### Scenario: Gate runs all stages
- **WHEN** `npm run rc1` is executed
- **THEN** every stage MUST run and its result MUST be recorded

#### Scenario: Machine-readable evidence
- **WHEN** the gate completes
- **THEN** it MUST write `artifacts/rc1/gate.json` containing `status`, `commit`, `node`, and one boolean per stage
- **AND** it MUST write `artifacts/rc1/report.md`

#### Scenario: Failure fails the gate
- **WHEN** any stage fails
- **THEN** `gate.json.status` MUST be `FAIL`
- **AND** the process MUST exit non-zero

### Requirement: CI and Release Separation
The real LLM benchmark MUST NOT be mandatory on every pull request.

#### Scenario: PR validation excludes the real benchmark
- **WHEN** CI runs on a pull request
- **THEN** it MUST run `npm test`, deterministic validation and package checks only
- **AND** the real benchmark MUST be required only for the release gate
