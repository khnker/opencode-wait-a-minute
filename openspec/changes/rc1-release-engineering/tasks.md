# Tasks

## 1. Deterministic Environment
- [ ] 1.1 Commit `package-lock.json` to the repository.
- [ ] 1.2 Update `.github/workflows/ci.yml` (L25) to use `npm ci`.
- [ ] 1.3 Update `.github/workflows/rc1-validation.yml` (L25) and `.github/workflows/release.yml` (L26) to use `npm ci`.
- [ ] 1.4 Verify that a fresh clone and `npm ci` succeeds.

## 2. Security and Package Hardening
- [ ] 2.1 Fix `scripts/verify-security.mjs`: implement PASS/FAIL/BLOCKED logic.
- [ ] 2.2 Fix `scripts/verify-security.mjs`: resolve audit error-shape bug (L62).
- [ ] 2.3 Fix `scripts/verify-published-package.mjs`: import `existsSync` from `fs`.
- [ ] 2.4 Fix `scripts/verify-published-package.mjs`: wrap `main()` in `async` to support dynamic `import`.
- [ ] 2.5 Implement registry-backed installation in `scripts/verify-published-package.mjs`.
- [ ] 2.6 Update `.github/workflows/release.yml` to include registry wait and `verify:published` step.

## 3. RC1 Evidence and Metrics
- [ ] 3.1 Update `scripts/release-gate.mjs` to make `benchmark:real` a required RC1 stage.
- [ ] 3.2 Fix `benchmarks/run-real.mjs` (L152-154) to exit non-zero if `WAM_BENCH_BASE_URL` is missing.
- [ ] 3.3 Implement real runtime measurements in `scripts/performance-sanity.mjs` (N=30, p95/p99).
- [ ] 3.4 Update reporting logic to separate `context_reduction`, `wam_overhead`, and `net_input_savings`.
- [ ] 3.5 Update `docs/benchmark/methodology.md` and `CHANGELOG.md` to reflect new metrics.
- [ ] 3.6 Implement the RC1 evidence bundle generation in `benchmarks/reports/rc1/` with full provenance.

## 4. Layout and Docs Cleanup
- [ ] 4.1 Freeze published surface in `package.json` (`files` and `main` fields).
- [ ] 4.2 Update `openspec/changes/harden-production-release-gate/` to remove references to `scripts/production-gate.mjs`.
