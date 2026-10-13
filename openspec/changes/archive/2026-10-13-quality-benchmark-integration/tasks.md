## Tasks

### CLI Integration
- [x] Update `benchmarks/cli.mjs` to include `quality` in the `SUITES` constant.
- [x] Import the quality benchmark runner in `benchmarks/cli.mjs` (similar to how `runValidationSuite` and `runDryRun` are imported).
- [x] Add a case in the dispatch logic to call the quality runner when `args.suite === 'quality'`.

### Quality Runner Adaptation
- [x] Examine `benchmarks/quality/run-quality.mjs` to understand its current output and structure.
- [x] Modify `benchmarks/quality/run-quality.mjs` to accept an options object that includes `outDir` (output directory) and `timestamp`.
- [x] Ensure the runner writes the four standard artifacts into the specified output directory:
  - `manifest.json`
  - `raw.json`
  - `metrics.json`
  - `report.md`
- [x] The runner must return a promise that resolves to an object containing the paths to the generated artifacts (or at least signals completion) so that the benchmark pipeline can wait for it.

### Manifest and Metadata
- [x] Define a schema version for the quality benchmark (e.g., "1.0.0") and include it in the manifest.
- [x] Generate the `manifest.json` with:
  - `generatedAt`: the timestamp passed to the runner (or current time if not provided).
  - `suite`: "quality"
  - `schemaVersion`: the defined version.
  - `sha256`: a map of the three artifact filenames (`raw.json`, `metrics.json`, `report.md`) to their SHA-256 hashes.
- [x] Ensure the `raw.json` contains the full output of the quality benchmark run (including per-scenario details, provider mode, model, etc.).
- [x] Ensure the `metrics.json` contains a normalized summary of key metrics (e.g., average fact coverage, pass rate, total scenarios, valid trials).
- [x] Ensure the `report.md` is a human-readable report that includes at least:
  - Summary table of metrics.
  - Breakdown by scenario or category.
  - Notes on invalid runs, exclusions, etc.
  - The command used, timestamp, and repository revision (if available).

### Deterministic Behavior
- [x] Verify that the quality benchmark runner does not make network calls by default (it should use the mock provider or direct scenario evaluation).
- [x] Ensure that the runner is repeatable: given the same input (scenarios, provider configuration, timestamp), it produces the same output.

### Test Coverage
- [x] Add a unit test for the CLI integration: test that `node benchmarks/cli.mjs --suite=quality --out=/tmp/test` runs without error and produces the expected output directory.
- [x] Add a unit test that verifies the four artifacts are created and have the expected structure (e.g., manifest.json has the required fields).
- [x] Ensure the existing unit tests for the quality benchmark scorer (`benchmarks/quality/scoring.test.mjs`) still pass and consider adding edge cases if necessary.
- [x] Add an end-to-end test that runs the quality suite via the CLI and checks that the report.md contains expected sections (e.g., a summary table).

### Documentation and Validation
- [x] Update any relevant documentation (e.g., README in `docs/benchmarks/` or the benchmark CLI's help text) to mention the new `quality` suite.
- [x] Ensure the change does not break existing benchmark suites or the existing CLI usage (run the existing benchmark suites to confirm).

## Reconciliation (2026-10-13)

Verified against the shipped implementation:

- The `quality` suite is registered in `benchmarks/cli.mjs` (`SUITES`), imported
  and dispatched; `benchmarks/cli.test.mjs` covers the CLI integration.
- `runQualitySuite` accepts `{ outDir, timestamp, provider, scenarios, trials }`
  and writes `raw.json`, `metrics.json`, `report.md`.
- **Single manifest source:** the fourth artifact (`manifest.json`) is emitted by
  the CLI envelope (`writeEnvelope` -> schema `rc1-cli-envelope@1`, per-artifact
  sha256), NOT by the runner. This avoids two manifest writers; the
  "runner writes four artifacts" task is satisfied at the pipeline level.
- Determinism: quality runs default to the offline `mock` provider and the
  envelope is validated by `benchmarks/cli.test.mjs`; `report.md` sections
  (`QUALITY BENCHMARK REPORT`, `Average Fact Coverage`) are asserted there.
- Docs: added the `--suite=quality` invocation to `docs/benchmarks/RC1.md`.

