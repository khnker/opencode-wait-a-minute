# Legacy Benchmarks

This directory is a **catalogue**, not a relocation target.

The benchmark harnesses listed below still live at the repository root. They are
imported by existing tests and by other modules, so **moving or deleting them
would break imports**. Their disposition is recorded in `index.json`; the files
themselves are intentionally left in place.

For all new benchmark work use the unified entrypoint:

```bash
node benchmarks/cli.mjs --suite=deterministic
node benchmarks/cli.mjs --suite=validation
node benchmarks/cli.mjs --suite=real
node benchmarks/cli.mjs --suite=all
```

See `benchmarks/cli.mjs` and the documents under `docs/benchmark/`.

## Why these are kept

- `context-benchmark.mjs` is imported by `context-benchmark-ground-truth.test.mjs`
  and depends on `context-optimization-metrics.js`. Its C06 metric gates
  (CRR / SPR / COR / CWR / PFR / RPC) are still asserted in the test suite.
- `context-benchmark-router.mjs` is exercised by `context-benchmark-router.test.mjs`.
- `context-benchmark.cwr.test.mjs` is a self-contained `node --test` file.

Deleting any of them would reduce coverage of the context selector's metric
gates. They are therefore **retained** and indexed, not superseded by deletion.

## Dispositions

See `index.json` for the machine-readable version, including a `rationale` field
per entry and a `disposition` of `retained` or `superseded-by`.

A harness marked `superseded-by benchmarks/` still runs and is still tested; the
disposition records that the **unified CLI is the preferred entrypoint** for new
evidence generation, not that the old file is dead.
