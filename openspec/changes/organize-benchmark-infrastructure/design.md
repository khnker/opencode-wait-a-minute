# Design: Benchmark Infrastructure

## Target

```text
wait-a-minute-plugin/
│
├── assessment/
├── context/
├── evidence/
├── lifecycle/
├── preflight/
├── runtime/
├── task/
├── tokens/
├── validation/
├── verification/
│
├── benchmarks/
│   ├── scenarios/
│   ├── fixtures/
│   ├── runners/
│   ├── analyzers/
│   ├── reporters/
│   ├── charts/
│   └── results/
│
├── scripts/
├── test/
├── tests/
└── openspec/
```

The first group remains WAM's domain architecture.

The second group is benchmark infrastructure.

## Dependency Direction

Benchmark dependencies should follow:

```text
scenarios
    ↓
runners
    ↓
raw evidence
    ↓
analyzers
    ↓
reporters
    ↓
results
```

Chart generation consumes analyzer output.

Scenarios must not depend on reporters or charts.

## Scenarios

A scenario defines:

* objective
* initial state
* expected work
* verification requirements
* benchmark parameters

It must not contain execution logic.

## Fixtures

Fixtures contain deterministic data required for tests and replay.

They must not depend on a developer's persistent `.wam/` state.

## Runners

Runners execute scenarios.

Expected runners include:

```text
deterministic.mjs
trace-replay.mjs
real-model.mjs
```

## Analyzers

Analyzers calculate metrics from evidence.

They must not execute WAM tasks.

## Reporters

Reporters transform normalized evidence into human-readable or machine-readable reports.

## Results

A run produces:

```text
benchmarks/results/<run-id>/
├── raw.json
├── summary.json
├── report.md
└── charts/
```

Generated results should normally be ignored by Git.

## Package

The npm package must be inspected after migration.

`benchmarks/`, `tests/`, `test/`, `openspec/` and development-only scripts must not enter the published package unless explicitly required.

## Migration

Migration sequence:

1. Create benchmark directories.
2. Move benchmark implementation.
3. Update imports.
4. Update npm commands.
5. Move benchmark tests/fixtures where appropriate.
6. Update documentation.
7. Verify package contents.
8. Run complete test suite.
9. Run production gate.
10. Remove obsolete benchmark files.
