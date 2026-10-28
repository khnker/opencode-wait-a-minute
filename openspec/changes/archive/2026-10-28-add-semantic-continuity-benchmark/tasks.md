## 1. Benchmark

- [x] 1.1 Build a temp-root fixture with the real ledger, canonical-delta,
      retention and task-hierarchy modules.
- [x] 1.2 Compare the legacy brief and the semantic projection on the same
      eight continuity probes under the same 4000-character budget.
- [x] 1.3 Count total tokens as brief tokens plus recovery tokens for loaded
      refs and keep the total inside the budget.
- [x] 1.4 Cover determinism, restart-from-disk, task isolation and group
      consolidation.

## 2. Wiring

- [x] 2.1 Add the `bench:semantic-continuity` npm script.
- [x] 2.2 Print a compact metrics table when the benchmark runs directly.

## 3. Verification

- [x] 3.1 `node --test --test-force-exit benchmarks/semantic-continuity.test.mjs`
- [x] 3.2 `npm run bench:semantic-continuity`
- [x] 3.3 `node --test --test-force-exit benchmarks/context-curation.test.mjs`
- [x] 3.4 `openspec validate --changes --strict`
- [x] 3.5 `npm run build`
- [x] 3.6 `node --test --test-force-exit tests/integration/semantic-pipeline.test.mjs`
      — one cross-phase flow proves hierarchy, ledger restart, retention, deltas,
      brief composition, isolation, consolidation, fail-loud and legacy fallback.
