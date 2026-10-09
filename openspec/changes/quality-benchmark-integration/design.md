# Design for Quality Benchmark Integration

## Overview

The quality benchmark evaluates whether the model's final answer (after chain-of-thought) contains the required facts.
It uses a deterministic scorer and an optional LLM judge.

We will integrate it into the official benchmark CLI and ensure it can be run via `node benchmarks/cli.mjs --suite=quality`.

## Components

1. **Quality Suite Entry Point**: Add a new benchmark suite named `quality` to the CLI.
2. **Runner**: Reuse or adapt the existing `run-quality.mjs` to fit the standard benchmark interface.
3. **Reporter**: Ensure the output matches the expected artifacts (manifest.json, raw.json, metrics.json, report.md).
4. **Tests**: Add unit tests for the CLI integration and end-to-end test for the quality suite.

## Implementation Details

### 1. CLI Integration

Modify `benchmarks/cli.mjs` to include `quality` in the `SUITES` and import the quality runner.

### 2. Quality Runner Adaptation

The existing `run-quality.mjs` currently runs the quality benchmark and writes a report. We need to adapt it to:
- Accept an output directory.
- Write the four standard artifacts.
- Use the same metadata structure (suite, schema version, etc.) as other suites.

### 3. Metadata and Artifacts

Each run must produce:
- `manifest.json`: includes `generatedAt`, `suite`, `schemaVersion`, and sha256 of the other three files.
- `raw.json`: the full raw output from the benchmark run (including per-scenario results).
- `metrics.json`: a compact summary of key metrics (e.g., average fact coverage, pass rate).
- `report.md`: a human-readable report.

### 4. Deterministic Offline Behavior

The quality benchmark must remain offline by default. It uses a mock provider or direct scenario evaluation without network.

### 5. Test Coverage

Add tests for:
- The new CLI option.
- The runner's ability to write the four artifacts.
- The scorer's unit tests (already exist, but we may add edge cases).
- End-to-end test that runs the quality suite and checks the output.

## Dependencies

- The existing quality benchmark code in `benchmarks/quality/`.
- The benchmark CLI and runner infrastructure.

## Risks

- Changing the CLI might affect existing users. We mitigate by keeping the default suite unchanged and adding the new suite as an option.
- Ensuring the output artifacts match the expected format requires careful adherence to the existing conventions.
