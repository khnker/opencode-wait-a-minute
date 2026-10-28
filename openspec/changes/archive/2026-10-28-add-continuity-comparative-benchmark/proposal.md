## Why

`benchmarks/semantic-continuity.test.mjs` compares only the legacy brief against
WAM on eight structural probes. It never tests WAM against a simpler strategy
under the same budget, and it never forces a naive strategy to keep information
that must not survive selection (superseded decisions, invalidated facts,
hypotheses). Without that contrast the benchmark cannot show that WAM's
curation is what preserves continuity.

## What Changes

- Add `benchmarks/continuity-comparison.test.mjs`: one rich fixture built with
  the real modules, three strategies (`full`, `top-k`, `wam`) under the same
  4000-character budget and the same ten continuity probes.
- Add the `bench:continuity-comparison` npm script.
- No production code changes. The benchmark only consumes existing modules.

## Impact

- Affected specs: `continuity-comparative-benchmark` (new capability)
- Affected code: `benchmarks/continuity-comparison.test.mjs`, `package.json`
  scripts
