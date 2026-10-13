# Specs for Quality Benchmark Integration

## Functional Specs

### CLI Entry Point
- The benchmark CLI (`benchmarks/cli.mjs`) must accept `--suite=quality` as a valid option.
- When `--suite=quality` is provided, it runs the quality benchmark suite.
- The default suite remains unchanged (deterministic).

### Runner Interface
- The quality benchmark runner must be a function that accepts:
  - `{ provider, scenarios, root, timestamp, trials, ablated }` similar to other runners.
  - It returns a promise that resolves to a result object compatible with the benchmark pipeline.
- The runner must write the four standard artifacts to the output directory:
  - `manifest.json`
  - `raw.json`
  - `metrics.json`
  - `report.md`

### Artifact Specs
#### manifest.json
- Must contain:
  - `generatedAt`: ISO timestamp string.
  - `suite`: "quality"
  - `schemaVersion`: a string (e.g., "1.0.0")
  - `sha256`: a map of the other three artifact filenames to their SHA-256 hashes.

#### raw.json
- Must contain the full output of the quality benchmark run, including:
  - Per-scenario results (input, output, extracted answer, scores, etc.).
  - Metadata about the run (provider mode, model, etc.).

#### metrics.json
- Must contain a normalized summary, e.g.:
  - `averageFactCoverage`: number
  - `passRate`: number (proportion of scenarios meeting a threshold, if applicable)
  - `totalScenarios`: integer
  - `validTrials`: integer
  - etc.

#### report.md
- Human-readable report, including:
  - Summary table of metrics.
  - Breakdown by scenario or category.
  - Notes on invalid runs, exclusions, etc.
  - Command used, timestamp, and repository revision if available.

### Deterministic Behavior
- The quality benchmark must run without network access by default (using a mock provider or direct evaluation).
- It must be repeatable: given the same input, it produces the same output.

### Test Coverage
- Unit tests for the scorer (`benchmarks/quality/scoring.test.mjs`) must cover:
  - Normalization: trimming, lowercasing, collapsing whitespace.
  - Fact coverage: substring containment in normalized strings.
  - JSON extraction from judge output (fenced and unfenced).
  - Final answer extraction: case-insensitive, last marker, fallback to whole text.
  - Aggregation: mean, median, etc.
  - Paired comparison: win/loss/tie counting with epsilon.
- End-to-end test for the quality suite CLI integration:
  - Run `node benchmarks/cli.mjs --suite=quality --out=/tmp/out`.
  - Verify that the four artifacts are created and have expected structure.
  - Verify that the report.md contains expected sections.

## Non-Functional Specs

### Performance
- The quality benchmark should complete in a reasonable time (under 30 seconds for the default scenario set).

### Dependencies
- No new external dependencies; reuse existing code.

### Compatibility
- Must not break existing benchmark suites or CLI usage.

## Open Questions
None.
