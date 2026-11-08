# Fix Benchmark Results Directory in Clean Checkouts

## Why

`benchmarks/results/` is gitignored, so a clean checkout (including GitHub Actions) does not contain it. `benchmarks/long-context.test.mjs` asserts the directory exists, which blocks the release gate in CI even though the benchmark itself is valid.

## What Changes

- `benchmarks/long-context.mjs` creates `benchmarks/results/` before writing an artifact.
- The test no longer depends on a pre-existing ignored directory; it creates it deterministically.
- Add a regression test that runs from a clean state.

## Non-Goals

- Changing benchmark measurements or thresholds.
- Committing generated benchmark artifacts.
