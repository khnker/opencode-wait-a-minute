# Quality Benchmark Integration

## ADDED Requirements

### Requirement: CLI Accepts the Quality Suite
The benchmark CLI (`benchmarks/cli.mjs`) MUST accept `--suite=quality` as a valid suite name alongside `deterministic`, `validation` and `real`, and MUST include `quality` in the exported `SUITES` catalogue. The default suite MUST remain `deterministic`.

#### Scenario: Quality suite is a known suite
- **WHEN** `SUITES` is read from `benchmarks/cli.mjs`
- **THEN** it contains `deterministic`, `validation`, `real` and `quality`

#### Scenario: Running the quality suite via the CLI
- **WHEN** the CLI is invoked as `node benchmarks/cli.mjs --suite=quality`
- **THEN** the quality runner executes and the uniform envelope is written under `<outDir>/quality/`

#### Scenario: Unknown suites still fail closed
- **WHEN** the CLI is invoked with a suite name that is not in `SUITES`
- **THEN** `parseArgs` throws an `Unknown suite` error

### Requirement: Uniform Envelope for the Quality Suite
The quality suite MUST emit the same four artifacts as every other suite — `manifest.json`, `raw.json`, `metrics.json`, `report.md` — using the shared `rc1-cli-envelope@1` layout, with the manifest hashing the other three artifacts.

#### Scenario: Envelope files are produced
- **WHEN** `runSuite("quality", { outDir })` resolves
- **THEN** `manifest.json`, `raw.json`, `metrics.json` and `report.md` exist and are non-empty inside `<outDir>/quality/`

#### Scenario: Manifest hashes the artifacts
- **WHEN** the quality envelope manifest is parsed
- **THEN** `schema` is `rc1-cli-envelope@1`, `suite` is `quality`, and each listed artifact carries a valid `sha256`

### Requirement: Offline, Deterministic Quality Run
The quality suite MUST run without network access by default, using the offline mock provider, and MUST be repeatable for identical inputs. It MUST score required-fact coverage for both the baseline and WAM arms, supporting both plain-string facts and `{ any: [...] }` fact specifications.

#### Scenario: Default run is offline
- **WHEN** the CLI runs the quality suite without an explicit provider
- **THEN** the emitted `metrics.json` reports `offline: true`

#### Scenario: Mixed fact specifications are scored
- **WHEN** a scenario rubric contains a `{ any: [...] }` fact
- **THEN** the fact counts as a single logical fact and is matched when any of its variants appears

### Requirement: Human-Readable Quality Report
The emitted `report.md` MUST be a human-readable summary containing at least the benchmark header, average fact coverage for both arms, the WAM-minus-baseline delta, and the win/loss/tie outcome counts.

#### Scenario: Report contains expected sections
- **WHEN** the quality envelope `report.md` is read
- **THEN** it contains the `QUALITY BENCHMARK REPORT` header and an `Average Fact Coverage` section

### Requirement: Non-Regression of Existing Suites
Adding the quality suite MUST NOT break the existing `deterministic`, `validation` or `real` suites, their CLI usage, or the shared quality scorer.

#### Scenario: Existing suites still run
- **WHEN** the full test suite runs after the change
- **THEN** all previously passing tests continue to pass
