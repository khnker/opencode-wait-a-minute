# Design: RC1 Phase 1 — Regression & Test Gate

## Architecture
- `scripts/release-gate.mjs`: Node script that runs test categories in sequence with custom summary output and correct exit codes.
- Test isolation: ensure tests using `.wam` set temporary or isolated directories per test file.
- Regression modules under `benchmarks/validation/` or a new `tests/regression/` hierarchy.
