# Change: Prepare RC1 Release Validation

## Why
RC1 must ship with reproducible, machine-readable evidence instead of "tests seem fine". The repository already exposes `bench:validation`, `benchmark:real`, `pack:test` and `smoke`, but there is no single gate that ties real baseline-vs-WAM measurement, deterministic validation, package verification and a fresh-install smoke into one auditable artifact. This change converts those existing points into a reproducible release gate rather than a parallel architecture.

## What Changes
- Add a real benchmark harness that runs the same task against BASELINE (OpenCode -> model -> task) and WAM (OpenCode -> WAM -> model -> task) and records per-run causal metrics, including `netInputSavings` and `breakEvenTurn`.
- Add five canonical RC1 scenarios: `local`, `contextual`, `continuation` (1/3/5/10/20 turns), `mutation` and `negative-control`.
- Add a release gate (`npm run rc1`) that composes `npm test`, deterministic validation, package verification, `npm pack` + fresh-install smoke, the real benchmark and evidence validation into `artifacts/rc1/{gate.json,report.md,...}`.
- Add package validation against the packed artifact (not the checkout), failing on a missing runtime module/`registry.json`/dependency, repo-relative paths, or development files leaking into the tarball.
- Replace the placeholder `Purpose` text in the three specs archived by `harden-context-efficiency-validation` (`regression-controls`, `snapshot-state-validation`, `workload-matrix`) with definitive purpose statements.
- **BREAKING**: none.

## Capabilities
### New Capabilities
- `real-agent-benchmark`: real baseline-vs-WAM execution, per-run causal metrics, `netInputSavings`, break-even reporting and canonical RC1 scenarios.
- `release-gate`: a single reproducible `npm run rc1` entrypoint that produces machine-readable PASS/FAIL evidence.
- `package-validation`: validation of the packed tarball via fresh install and plugin smoke in a temporary project.

### Modified Capabilities
- (none)

## Impact
- Code: `benchmarks/scenarios/*`, `benchmarks/runners/*`, `benchmarks/run-real.mjs`, `benchmarks/evaluation/*`, `scripts/rc1-gate.mjs`, `scripts/verify-package.mjs`.
- CI/release: `.github/workflows/rc1-validation.yml`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`.
- Docs/evidence: `CHANGELOG.md`, `artifacts/rc1/*`, `benchmarks/README.md`.
- `package.json` scripts: `validate`, `rc1`, `rc1:package` (no new runtime dependencies).
