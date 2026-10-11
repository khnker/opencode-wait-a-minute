# Change: Fix Benchmark Audit in Fresh / Non-Git Environments
## Why
`benchmarks/validation/audit-results.mjs` (npm `bench:audit` / `bench:validate`) fails in a fresh checkout:
1. `latestResultsDir` returns the newest directory that merely contains a `raw.json`, regardless of format. A trace-replay run (`run.mjs`/`cli.mjs`) written after a validation run (`run-validation.mjs`) shadows the validation artifact, so `buildAudit` reads `composition`/`causal` from the wrong file and yields `{"ok":false,"resultsChecked":0,"errors":["empty results array"]}`.
2. `gitProvenance()` returns `gitSha=null` outside a git checkout, so every result fails `result.commit must be a non-empty string` (`ok:false`, 8 errors) even though the scenarios are found.
Reproduced in a clean user (`wambench`) with a copy of the repo: `bench:audit` failed until `git init` was run and the trace-replay dir was removed.
## What Changes
- `latestResultsDir` only selects directories whose `raw.json` is a validation-format artifact (has `composition`).
- `buildAudit` resolves the commit via `resolveCommit()`, falling back to `"unknown"` when there is no git provenance (matching the existing `repoCommit: "unknown"` convention).
- Regression tests for both behaviours.
## Non-goals
- Changing the validation or trace-replay artifact schemas.
- Requiring git for benchmark runs.
## Expected Result
`bench:audit` / `bench:validate` return `ok:true` with the correct `resultsChecked` count in a fresh, non-git checkout, independent of the order in which benchmark runs are executed.
