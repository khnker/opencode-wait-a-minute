# Change: RC1 Release Engineering

## Why
RC1 cannot be declared reproducible while the install path is non-deterministic, the security gate can silently pass, the published-package verifier cannot run at all, and the RC1 evidence gate can exit 0 without ever running the real benchmark. The punch list is known and verified; this change hardens the existing release tooling and plans a staged layout migration instead of adding any new cognitive feature.

## What Changes
- **Deterministic install**: commit `package-lock.json` and switch `ci.yml`, `rc1-validation.yml` and `release.yml` from `npm install` to `npm ci`; a clean-checkout `npm ci` MUST succeed.
- **Strict security gate**: `scripts/verify-security.mjs` MUST classify `0 vulns` as PASS, `high`/`critical` as FAIL, and an unavailable/network-error audit as BLOCKED — never a silent warning. Fix the audit error-shape bug.
- **Published-package verification**: repair `scripts/verify-published-package.mjs` (missing `existsSync` import, dynamic `import` in a non-async `main`) so it installs the exact published version from the registry and verifies files and tarball, not just local directory existence.
- **RC1 evidence gate**: make `benchmark:real` (`benchmarks/run-real.mjs`) a required RC1 stage in `scripts/release-gate.mjs` and stop `benchmarks/run-real.mjs` from silently `process.exit(0)` when `WAM_BENCH_BASE_URL` is unset; keep the deterministic CI gate separate.
- **Post-publish verification**: `.github/workflows/release.yml` waits for registry propagation after `npm publish`, installs the exact published version and runs `verify:published`.
- **Real performance baseline**: replace the `fs.access`/`fs.stat` placeholder in `scripts/performance-sanity.mjs` with real measurements (preflight, classification, context assembly, skill routing, continuation fast-path, completion gate, task persistence) at N≥30 with median/p95/p99; non-blocking for RC1 but real.
- **Metric separation (BREAKING for reports)**: formalize `context_reduction`, `wam_overhead` and `net_input_savings` as three distinct metrics; remove the ambiguous `TokenReductionPct`.
- **RC1 evidence bundle**: `benchmarks/reports/rc1/` MUST contain `summary.json`, `report.md`, `manifest.json` and `methodology.md` with the full provenance field set.
- **Package-surface freeze (P1)**: plan a staged `src/` migration by freezing the published surface (`package.json` `files`/`main`) first; source files are NOT moved in this change.
- **Doc drift**: update `openspec/changes/harden-production-release-gate/` to stop referencing the removed `scripts/production-gate.mjs`.

## Capabilities
### New Capabilities
- `deterministic-install`: lockfile-backed reproducible installs across CI and release workflows.
- `release-security-gate`: tri-state PASS/FAIL/BLOCKED dependency-audit gate with consistent error handling.
- `published-package-verification`: registry-backed exact-version install and tarball verification, plus post-publish workflow verification.
- `rc1-release-evidence`: required real-benchmark RC1 gate, real runtime performance baseline, separated savings metrics and the evidence bundle.
- `package-surface-migration`: frozen published surface as the precondition for a staged `src/` migration.
- `release-documentation-consistency`: removal of stale references to deleted release scripts.

### Modified Capabilities
_None. All changes are new capability deltas within this change._

## Impact
- Workflows: `.github/workflows/ci.yml` (L25), `.github/workflows/rc1-validation.yml` (L25), `.github/workflows/release.yml` (L26).
- Scripts: `scripts/verify-security.mjs`, `scripts/verify-published-package.mjs`, `scripts/release-gate.mjs`, `scripts/performance-sanity.mjs`.
- Benchmarks: `benchmarks/run-real.mjs` (L152-154), `benchmarks/reports/rc1/`.
- Docs: `docs/benchmark/methodology.md` (L27), `CHANGELOG.md` (L41), `openspec/changes/harden-production-release-gate/`.
- Repo hygiene: root `.js`/`.mjs` layout (286 files, no `src/`) — plan only, no files moved.
