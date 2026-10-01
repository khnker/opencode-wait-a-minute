# Design: Prepare RC1 Release Validation

## Context
RC1 needs reproducible evidence. The repository already provides the building blocks:
- `bench:validation` — deterministic snapshot/workload validation (`benchmarks/run-validation.mjs`).
- `benchmark:real` — real-LLM suite (`benchmarks/run-real.mjs`) driven by `benchmarks/runners/real-session.mjs`, `baseline-runner.mjs`, `wam-runner.mjs` and `benchmarks/providers/openai-compatible.mjs`.
- `pack:test` (`scripts/verify-package.mjs`) and `smoke`.
- `.github/workflows/ci.yml` and `release.yml`.

The gate MUST compose these, not replace them.

## Data Flow
```
scenario ──► real-session ──► { turns:[{ turnIndex, baseline, wam }], totals, counters }
                                     │
                                     ▼
                          normalize RunResult (causal fields)
                                     │
                                     ▼
                        compareRuns() ──► netInputSavings, breakEvenTurn
                                     │
                                     ▼
                              real-report.json
```

## Decisions
- **Reuse runners.** `baseline-runner.mjs` / `wam-runner.mjs` already exist and are one turn each; `run-real.mjs` orchestrates them per scenario. The harness adds a normalization + comparison layer instead of new execution paths.
- **Charge overhead explicitly.** `netInputSavings = baselineInputTokens - (wamInputTokens + wamOverheadTokens)`. WAM fixed overhead is subtracted exactly once; negatives are preserved.
- **Deterministic vs real split.** Deterministic validation (`bench:validation`) stays in PR CI; the real benchmark runs only in the release gate because it requires a provider + model.
- **Evidence over assertion.** `artifacts/rc1/gate.json` records a boolean per stage; `report.md` is the human-readable artifact. A failing stage sets `status: FAIL` and a non-zero exit.
- **Test the artifact.** Package validation runs `npm pack`, installs the tarball into a temp project and imports WAM there, so repo-relative assumptions and missing `files` entries surface as failures.
- **No success threshold.** The change measures behavior (including break-even = `null`); it does not impose "must save X%".
- **No new dependencies.** Uses Node stdlib and existing scripts.

## Risks
- Real benchmark requires provider credentials; the gate MUST skip-with-explicit-FAIL (not silently PASS) when the real stage is required but unavailable.
- CI minutes: the real stage is release-only to avoid PR cost.
