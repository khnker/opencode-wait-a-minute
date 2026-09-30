# Specification: Benchmark Layout

## ADDED Requirements

### Requirement: Dedicated benchmark subsystem

All benchmark implementation MUST live under `benchmarks/`.

#### Scenario: Benchmark code location
- **WHEN** benchmark implementation is added
- **THEN** it lives under `benchmarks/`

### Requirement: Domain preservation

Existing WAM domain directories MUST NOT be moved solely to create a conventional `src/` hierarchy.

#### Scenario: Reorganization
- **WHEN** the benchmark subsystem is reorganized
- **THEN** existing WAM domain directories are not moved solely to create a `src/` hierarchy

### Requirement: Separation of concerns

The benchmark subsystem MUST distinguish:

* scenarios
* fixtures
* runners
* analyzers
* reporters
* charts
* generated results

#### Scenario: Subsystem layout
- **WHEN** the benchmark subsystem is inspected
- **THEN** scenarios, fixtures, runners, analyzers, reporters, charts and generated results are distinguished

### Requirement: Scripts boundary

`scripts/` MUST contain repository operational tooling.

Benchmark implementation MUST NOT be added there after migration.

#### Scenario: Operational tooling
- **WHEN** repository operational tooling is required
- **THEN** it lives in `scripts/` and benchmark implementation is not added there after migration

### Requirement: Dependency direction

Benchmark dependencies MUST follow:

```text
scenario → runner → evidence → analyzer → reporter
```

#### Scenario: Dependency order
- **WHEN** benchmark modules depend on each other
- **THEN** they follow scenario → runner → evidence → analyzer → reporter

### Requirement: Generated results

Generated benchmark results MUST be separated from benchmark source code.

#### Scenario: Results separated
- **WHEN** a benchmark run generates results
- **THEN** those results are stored separately from benchmark source code

### Requirement: Runtime isolation

Benchmark fixtures MUST NOT depend on persistent developer runtime state.

#### Scenario: Fixture independence
- **WHEN** benchmark fixtures are loaded
- **THEN** they do not depend on persistent developer runtime state

### Requirement: Package boundary

Benchmark infrastructure MUST NOT unintentionally enter the npm package.

#### Scenario: Package published
- **WHEN** the npm package is produced
- **THEN** benchmark infrastructure does not enter the package

### Requirement: Compatibility

Existing supported commands MUST continue to work or have documented replacements.

#### Scenario: Existing commands
- **WHEN** supported commands are used after migration
- **THEN** they continue to work or have documented replacements
