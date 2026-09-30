# Change: Restructure Benchmark and Project Layout

## Why

The repository currently has a growing distinction between product code, tests, benchmark execution, benchmark analysis, generated evidence, and repository tooling.

The current layout is functional, but benchmark functionality is becoming concentrated in individual scripts under `scripts/`.

This makes the benchmark harder to extend and obscures the distinction between:

* product implementation
* correctness tests
* performance benchmarks
* benchmark fixtures
* benchmark analysis
* generated evidence
* repository operations

The repository should adopt a structure that reflects these responsibilities explicitly.

## What Changes

The benchmark subsystem will be organized under `benchmarks/`.

The target structure is:

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

### `scenarios/`

Contains benchmark scenario definitions.

### `fixtures/`

Contains deterministic execution traces and test data.

### `runners/`

Contains benchmark execution engines.

### `analyzers/`

Contains logic that transforms raw execution evidence into normalized measurements.

### `reporters/`

Contains report and evidence generation.

### `charts/`

Contains visualization generation code.

### `results/`

Contains generated benchmark output.

## Scripts

`scripts/` remains reserved for repository-level operational commands (production gate, release validation, etc.).

## Non-Goals

This change does not:

* modify WAM runtime behavior
* modify governance semantics
* change benchmark methodology
* alter token calculations
* change production-gate semantics
* remove OpenSpec
