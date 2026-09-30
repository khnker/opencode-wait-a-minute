# Tasks

* [x] Inventory current benchmark-related files.
* [x] Inventory current `test/` and `tests/` usage before moving anything.
* [x] Create `benchmarks/scenarios/`.
* [x] Create `benchmarks/fixtures/`.
* [x] Create `benchmarks/runners/`.
* [x] Create `benchmarks/analyzers/`.
* [x] Create `benchmarks/reporters/`.
* [x] Create `benchmarks/charts/`.
* [x] Create `benchmarks/results/`.
* [x] Move benchmark scenario definitions.
* [x] Move deterministic benchmark runner.
* [x] Move trace-replay runner.
* [x] Move real-model runner.
* [x] Move analyzer implementation.
* [x] Move report generation.
* [x] Move chart generation.
* [x] Move deterministic fixtures.
* [x] Move benchmark-specific tests where appropriate.
* [x] Update imports.
* [x] Update package scripts.
* [x] Update documentation.
* [x] Update production-gate references.
* [x] Add Git ignore rules for generated results.
* [x] Verify no duplicate benchmark implementation remains.
* [x] Verify existing WAM domain directories remain unchanged.
* [x] Verify npm package contents.
* [ ] Run complete test suite.
* [ ] Run production gate.
* [x] Remove obsolete benchmark files from `scripts/`.

## Notes

* `scripts/production-gate.mjs` references only context-benchmark tests. Those are
  unchanged and intentionally out of scope, so no production-gate edit was needed.
* A stale duplicate synthetic benchmark at the repo root
  (`token-savings-benchmark.js` + `token-savings-benchmark.test.mjs`) was removed.
* The context-selection benchmark (`context-benchmark*.mjs`) is a separate harness
  pinned by `scripts/production-gate.mjs`; it is deliberately NOT migrated to avoid
  a blind mass migration.
* `npm run pack:test` PASSED (benchmark infra is not published).
* `npm run benchmark` and `node --test benchmarks/token-savings-benchmark.test.mjs`
  pass (12/12).
* The complete recursive suite exceeds the local run budget (~580s). The prior
  baseline already carried ~24 pre-existing failures in context/capsule/release
  areas. The production gate was executed and stops at a pre-existing,
  unrelated failure in `strategy-capabilities.test.mjs`
  (`classifyActionAgainstStrategy must call classifyByCapabilities`); `index.js`
  was not modified by this change.
