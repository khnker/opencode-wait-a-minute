# Tasks

## Commit 1 — Real Benchmark Harness
- [x] Normalize `RunResult` from `benchmarks/runners/real-session.mjs` (causal fields: inputTokens, outputTokens, totalTokens, contextTokens, wamOverheadTokens, contextRebuilds, fastPathCount, partialRebuildCount, fullRebuildCount, verification).
- [x] Add `compareRuns()` producing `netInputSavings` (overhead charged once) and `breakEvenTurn`.
- [x] Add `benchmarks/evaluation/compare-runs.mjs` + JSDoc typedefs and a deterministic test.
- [x] Extend `benchmarks/run-real.mjs` to emit `real-report.json`.
- [x] Add canonical scenario descriptors under `benchmarks/scenarios/` (local, contextual, continuation, mutation, negative-control).
- [x] Assert negative-control results are preserved (never clamped).

## Commit 2 — Mutation Scenarios and Cost Model
- [ ] Add the multi-turn mutation sequence (full, fast, fast, partial, fast, full, fast).
- [ ] Add the break-even table (`turns | baseline | WAM | overhead | net | cumulative`) to the real report.
- [ ] Add continuation turn scaling 1/3/5/10/20 wired to the real harness.

## Commit 3 — Package and Release Gate
- [ ] Add `scripts/rc1-gate.mjs` composing test, deterministic validation, package verification, `npm pack`, fresh-install smoke, real benchmark, evidence validation.
- [ ] Write `artifacts/rc1/{gate.json,report.md}`; fail non-zero on any stage failure.
- [ ] Add `npm run rc1`, `npm run rc1:package`, `npm run validate` scripts.
- [ ] Add `.github/workflows/rc1-validation.yml`; keep PR CI free of the real benchmark.

## Commit 4 — Specs and Release Validation
- [ ] Replace placeholder `Purpose` in `openspec/specs/{regression-controls,snapshot-state-validation,workload-matrix}/spec.md`.
- [ ] Run the full deterministic suite and the real benchmark; record evidence.
- [ ] Update `CHANGELOG.md` with RC1 validation notes.
- [ ] Tag `v1.1.0-rc.1`.
