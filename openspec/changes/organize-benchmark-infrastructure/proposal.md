# Change: Organize Benchmark Infrastructure

## Why

The repository has a modular domain-oriented structure where directories such as `assessment`, `context`, `evidence`, `runtime`, `task`, `tokens` and `verification` represent WAM functionality.

That architecture should remain unchanged.

Benchmark infrastructure is different: it is development tooling used to measure and validate the system.

The current token benchmark is located under `scripts/`, which mixes repository operations with benchmark implementation.

## What Changes

Create a dedicated `benchmarks/` subsystem.

Target:

```text
benchmarks/
├── scenarios/
├── fixtures/
├── runners/
├── analyzers/
├── reporters/
├── charts/
└── results/
```

### scenarios

Benchmark scenario definitions.

### fixtures

Deterministic traces and benchmark test data.

### runners

Benchmark execution engines.

### analyzers

Measurement and statistical analysis.

### reporters

Markdown/JSON report generation.

### charts

Chart-generation implementation.

### results

Generated benchmark evidence.

## Scripts

`scripts/` remains reserved for repository-level operations such as:

* production gate
* release validation
* package validation
* maintenance commands

Benchmark implementation must not accumulate there.

## Existing WAM Structure

This change MUST NOT move or rename the existing WAM domain directories merely for aesthetic reasons.

In particular, directories such as:

```text
assessment/
context/
evidence/
lifecycle/
preflight/
runtime/
task/
tokens/
validation/
verification/
```

remain in their current locations.

## Tests

Existing tests should only be reorganized when there is a clear responsibility boundary.

The simultaneous presence of `test/` and `tests/` must be analyzed before moving either directory.

No blind mass migration is permitted.

## Package Boundary

Benchmark infrastructure must not be unintentionally included in the npm package.

The package contents must be verified after the migration.

## Compatibility

Existing benchmark and validation commands must either continue working or have documented replacements.

## Non-Goals

This change does not modify:

* WAM runtime architecture
* domain directories
* governance
* lifecycle
* task management
* token accounting
* benchmark methodology
