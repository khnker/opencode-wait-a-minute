# Design: Benchmark and Project Layout

## Target Directory Structure

```text
benchmarks/
├── scenarios/
│   ├── index.js
│   └── simple-refactor.json
├── fixtures/
│   └── traces/
│       ├── baseline-trace.json
│       └── wam-trace.json
├── runners/
│   ├── replay-runner.js
│   └── real-model-runner.js
├── analyzers/
│   ├── token-analyzer.js
│   └── progress-analyzer.js
├── reporters/
│   ├── markdown-reporter.js
│   └── json-reporter.js
├── charts/
│   └── svg-generator.js
└── results/
    └── .gitkeep

scripts/
├── wam-audit.mjs
└── production-validation-gate.mjs
```

## Migration Plan

1. Create target directories.
2. Move existing benchmark scripts from `scripts/` to their designated benchmark subdirectories.
3. Update imports and paths.
4. Verify all tests pass.
5. Verify benchmark execution still functions correctly.

## Invariants

* Operational scripts remain in `scripts/`.
* Benchmark logic resides entirely within `benchmarks/`.
* Generated results remain under `benchmarks/results/`.
* No changes to WAM core logic or behavior.
