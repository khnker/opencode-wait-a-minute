# Design: Fix Benchmark Results Directory

## Research

- Node.js `fs.mkdirSync` recursive option: <https://nodejs.org/api/fs.html#fsmkdirsyncpath-options>
- npm `files`/`.gitignore` behavior for generated artifacts: <https://docs.npmjs.com/cli/v10/configuring-npm/package-json>

## Alternatives

1. **Commit an empty `benchmarks/results/.gitkeep`** — rejected: the directory is intentionally ignored and generated output should not be tracked.
2. **Remove the existence assertion** — rejected: it hides the real contract that the runner must be able to write its artifact.
3. **Create the directory on demand in the runner and test** — chosen: deterministic in clean checkouts and preserves the artifact contract.

## Decision

`main()` and the test call `mkdirSync(resultsDir, { recursive: true })` before writing or asserting. Generated JSON stays untracked.

## Risks

- None to runtime behavior; only benchmark tooling and tests.
