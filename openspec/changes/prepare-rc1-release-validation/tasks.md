# Tasks

## Commit 1 — Real Benchmark Harness
- [x] Normalize `RunResult` from `benchmarks/runners/real-session.mjs` (causal fields: inputTokens, outputTokens, totalTokens, contextTokens, wamOverheadTokens, contextRebuilds, fastPathCount, partialRebuildCount, fullRebuildCount, verification).
- [x] Add `compareRuns()` producing `netInputSavings` (overhead charged once) and `breakEvenTurn`.
- [x] Add `benchmarks/evaluation/compare-runs.mjs` + JSDoc typedefs and a deterministic test.
- [x] Extend `benchmarks/run-real.mjs` to emit `real-report.json`.
- [x] Add canonical scenario descriptors under `benchmarks/scenarios/` (local, contextual, continuation, mutation, negative-control).
- [x] Assert negative-control results are preserved (never clamped).

## Commit 2 — Mutation Scenarios and Cost Model
- [x] Add the multi-turn mutation sequence (full, fast, fast, partial, fast, full, fast) in `benchmarks/scenarios/rc1.mjs`.
- [x] Add the break-even computation (`cumulative` + `breakEvenTurn`) in `benchmarks/evaluation/compare-runs.mjs` and surface it in the real report.
- [x] Add continuation turn scaling 1/3/5/10/20 (`CONTINUATION_TURNS` in `benchmarks/scenarios/workloads.mjs`) wired to the real harness.

## Commit 3 — Package and Release Gate
- [x] Add `scripts/release-gate.mjs` composing version parity, package integrity, security audit, migration/isolation E2E, OpenCode smoke E2E and performance sanity; fails non-zero on any required stage.
- [x] Emit machine-readable RC1 evidence to `benchmarks/reports/rc1/{manifest.json,report.md,raw.json,metrics.json,comparison.json,evidence.json}` via `npm run report:rc1`.
- [x] Add `npm run rc1`, `npm run validate` and `npm run production:gate` aliases for the unified gate.
- [x] Add `.github/workflows/rc1-validation.yml` (manual + `v1.1.0-rc.*` tags); PR CI stays free of the real benchmark.

## Commit 4 — Specs and Release Validation
- [x] Replace placeholder `Purpose` in `openspec/specs/{regression-controls,snapshot-state-validation,workload-matrix}/spec.md`.
- [x] Run the full deterministic suite (`npm run bench:validation`) and the real benchmark both as dry-run and against a live OpenAI-compatible provider (`WAM_BENCH_*`, model `auto/best-fast`); record evidence (`npm run report:rc1`).
- [x] Update `CHANGELOG.md` with RC1 validation notes.
- [ ] Tag `v1.1.0-rc.1` (pending final approval).
