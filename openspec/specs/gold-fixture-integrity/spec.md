# gold-fixture-integrity Specification

## Purpose
TBD - created by archiving change harden-prompt-eval-gold-capture. Update Purpose after archive.
## Requirements
### Requirement: Gold capture CLI must support `--help` without side effects

`scripts/prompts-capture-gold.mjs` and `scripts/prompts-calibrate.mjs` SHALL accept `--help` (or `-h`) and, on receipt, print usage documentation and exit with status 0 **before** any provider resolution, file-system access, or output-file write.

#### Scenario: capture-gold --help prints usage and writes nothing

- **GIVEN** `scripts/prompts-capture-gold.mjs` is invoked with `--help`
- **WHEN** the process runs
- **THEN** stdout begins with `Usage: node scripts/prompts-capture-gold.mjs`
- **AND** the process exits with status 0
- **AND** no file in the target directory is created or modified

#### Scenario: calibrate --help prints usage and writes nothing

- **GIVEN** `scripts/prompts-calibrate.mjs` is invoked with `--help`
- **WHEN** the process runs
- **THEN** stdout begins with `Usage: node scripts/prompts-calibrate.mjs`
- **AND** the process exits with status 0
- **AND** no calibration report is written

### Requirement: Capture must refuse to silently overwrite a frozen gold fixture

`scripts/prompts-capture-gold.mjs` SHALL refuse to write raw outputs or `meta.json` into any directory that already contains a frozen gold fixture (detected by the presence of `meta.json` and/or a `raw/` subdirectory), unless `--force` is explicitly passed. The refusal is non-zero and leaves all fixture bytes unchanged.

#### Scenario: Overwriting a frozen fixture without `--force` is refused

- **GIVEN** a directory already contains `meta.json` and/or `raw/`
- **WHEN** `scripts/prompts-capture-gold.mjs` targets that directory without `--force`
- **THEN** the command exits with a non-zero status
- **AND** stderr contains `Refusing to overwrite`
- **AND** every byte of every file under the target directory is byte-identical to its state before the invocation

#### Scenario: The canonical frozen gold directory cannot be silently overwritten

- **GIVEN** `benchmarks/quality/prompt-eval/gold/v1-provisional` contains the calibrated gold fixture
- **WHEN** `scripts/prompts-capture-gold.mjs` is invoked without `--out` and without `--force`
- **THEN** the command exits with a non-zero status
- **AND** the fixture under `gold/v1-provisional/{meta.json,raw/*.json}` is byte-identical before and after the invocation
- **AND** the calibration gate (κ) computed from the fixture remains 1.0

### Requirement: Mock/dry-run capture into the canonical gold directory requires explicit intent

`scripts/prompts-capture-gold.mjs` SHALL refuse to capture mock/dry-run provider outputs into the canonical gold directory without `--force`. Mock captures to any other `--out` directory are permitted without `--force`, to support offline testing.

#### Scenario: Implicit mock fallback into canonical dir is refused

- **GIVEN** no provider is configured (`WAM_BENCH_BASE_URL` unset, `WAM_BENCH_REAL_MODEL` unset)
- **WHEN** `scripts/prompts-capture-gold.mjs` is invoked without `--force` and without `--out`
- **THEN** the command exits with a non-zero status
- **AND** stderr references `mock` or `dry-run`
- **AND** no provider network call is attempted
- **AND** the canonical gold fixture bytes are unchanged

#### Scenario: Explicit `--force` overrides both guards

- **GIVEN** a directory with a frozen fixture (or the canonical dir with no configured provider)
- **WHEN** `scripts/prompts-capture-gold.mjs` is invoked with `--force`
- **THEN** the capture proceeds and overwrites the fixture
- **AND** the exit status is 0 on successful write

### Requirement: Unknown flags on capture-gold must fail closed

`scripts/prompts-capture-gold.mjs` SHALL reject any `-`-prefixed argument not in its recognized option set. On unknown flags, it prints usage and exits non-zero before any provider resolution or capture.

#### Scenario: Unknown flag aborts before capture

- **GIVEN** an unrecognized `-`-prefixed flag is passed
- **WHEN** `scripts/prompts-capture-gold.mjs` runs
- **THEN** the process exits with status 2
- **AND** stderr lists the unknown flag
- **AND** no capture or file write occurs

