# Benchmarks

Development-only measurement tooling. Not part of the published npm package.

## Layout

```text
benchmarks/
├── scenarios/   scenario definitions (objective, expected work, verification)
├── fixtures/    deterministic recorded execution traces
├── runners/      execution engines (trace-replay, real-model)
├── analyzers/    measurement + statistics
├── reporters/    JSON/Markdown report generation
├── charts/       SVG chart generation
└── results/      generated evidence (gitignored)
```

## Run

```bash
npm run benchmark        # deterministic trace replay -> benchmarks/results/<timestamp>/
node --test benchmarks/token-savings-benchmark.test.mjs
```

Each run writes `raw.json`, `summary.json`, `report.md` and `charts/*.svg`.

## Methodology

Token counts are derived from **recorded per-turn execution traces**, never from
scenario constants. Baseline and WAM traces represent equivalent tasks; the only
intended difference is the presence or absence of WAM. Negative savings are valid
evidence and are never clamped to zero.

## Claims policy

Every measurement is classified as one of:

- `observed` — reported directly by the provider or execution trace
- `measured` — calculated from captured execution data
- `derived` — calculated from measured values
- `estimated` — inferred using a declared estimator

Estimated values are never presented as observed.

## Real-model execution

Opt-in only (`WAM_BENCH_REAL_MODEL=1`). No provider adapter is wired yet; the
deterministic trace replay is what CI executes.

## Out of scope

The context-selection benchmark (`context-benchmark.mjs`,
`context-benchmark-router.mjs` and their tests) is a separate evaluation harness.
It is pinned by `scripts/production-gate.mjs` and is intentionally **not** migrated
in this change to avoid a blind mass migration.
