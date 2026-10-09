## Tasks

### CLI Integration
- [ ] Update `benchmarks/cli.mjs` to include `quality` in the `SUITES` constant.
- [ ] Import the quality benchmark runner in `benchmarks/cli.mjs` (similar to how `runValidationSuite` and `runDryRun` are imported).
- [ ] Add a case in the dispatch logic to call the quality runner when `args.suite === 'quality'`.

### Quality Runner Adaptation
- [ ] Examine `benchmarks/quality/run-quality.mjs` to understand its current output and structure.
- [ ] Modify `benchmarks/quality/run-quality.mjs` to accept an options object that includes `outDir` (output directory) and `timestamp`.
- [ ] Ensure the runner writes the four standard artifacts into the specified output directory:
  - `manifest.json`
  - `raw.json`
  - `metrics.json`
  - `report.md`
- [ ] The runner must return a promise that resolves to an object containing the paths to the generated artifacts (or at least signals completion) so that the benchmark pipeline can wait for it.

### Manifest and Metadata
- [ ] Define a schema version for the quality benchmark (e.g., "1.0.0") and include it in the manifest.
- [ ] Generate the `manifest.json` with:
  - `generatedAt`: the timestamp passed to the runner (or current time if not provided).
  - `suite`: "quality"
  - `schemaVersion`: the defined version.
  - `sha256`: a map of the three artifact filenames (`raw.json`, `metrics.json`, `report.md`) to their SHA-256 hashes.
- [ ] Ensure the `raw.json` contains the full output of the quality benchmark run (including per-scenario details, provider mode, model, etc.).
- [ ] Ensure the `metrics.json` contains a normalized summary of key metrics (e.g., average fact coverage, pass rate, total scenarios, valid trials).
- [ ] Ensure the `report.md` is a human-readable report that includes at least:
  - Summary table of metrics.
  - Breakdown by scenario or category.
  - Notes on invalid runs, exclusions, etc.
  - The command used, timestamp, and repository revision (if available).

### Deterministic Behavior
- [ ] Verify that the quality benchmark runner does not make network calls by default (it should use the mock provider or direct scenario evaluation).
- [ ] Ensure that the runner is repeatable: given the same input (scenarios, provider configuration, timestamp), it produces the same output.

### Test Coverage
- [ ] Add a unit test for the CLI integration: test that `node benchmarks/cli.mjs --suite=quality --out=/tmp/test` runs without error and produces the expected output directory.
- [ ] Add a unit test that verifies the four artifacts are created and have the expected structure (e.g., manifest.json has the required fields).
- [ ] Ensure the existing unit tests for the quality benchmark scorer (`benchmarks/quality/scoring.test.mjs`) still pass and consider adding edge cases if necessary.
- [ ] Add an end-to-end test that runs the quality suite via the CLI and checks that the report.md contains expected sections (e.g., a summary table).

### Documentation and Validation
- [ ] Update any relevant documentation (e.g., README in `docs/benchmarks/` or the benchmark CLI's help text) to mention the new `quality` suite.
- [ ] Ensure the change does not break existing benchmark suites or the existing CLI usage (run the existing benchmark suites to confirm).
