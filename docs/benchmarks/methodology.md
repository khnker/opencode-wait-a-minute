# Token Accounting & Benchmark Methodology

Status: first pass (RC1 pre-work, change 3 of 5)
Date: 2026-10-05

## Token Accounting

Source: `src/engine.js`.

- `estimateTokens(text) = Math.ceil(text.length / 4)` — a cheap chars/4 proxy. It is
  deliberately NOT a real tokenizer: it is deterministic, dependency-free, and used
  for relative comparisons and budgets, never for billing.
- `cavemanify(text)` removes filler phrases, collapses repeated spaces/tabs, and
  collapses 3+ blank lines to 2 before measurement. Reduction claims must state
  whether they are measured before or after `cavemanify`.
- Budgets consume `estimateTokens` (e.g. `DEFAULT_VERIFICATION_BUDGET.maxTokens`).
  A budget breach is a comparison against this proxy, not a provider count.

Rule: any documented "% token reduction" MUST be computed with the same proxy on
both sides. Never mix provider token counts with `estimateTokens`.

## Context Evaluation Metrics

Source: `src/context-evaluation.js#computeMetrics`.

Each strategy is scored per scenario on:

| Metric | Definition |
|---|---|
| `recall` | expected nodes retrieved / expected nodes |
| `precision` | retrieved nodes that are expected / retrieved nodes |
| `dependencyCoverage` | 0 if any expected dependency is missing, else 1 |
| evidence coverage | presence of required evidence nodes |
| `taskSuccess` | expected nodes non-empty AND recall == 1 |
| `contextTokens` | `result.tokenEstimate` for the assembled context |

Strategies currently benchmarked by `runScenario`: `full-context`, `semantic-topk`
(k=10), `wam-routing` (`resolveContext`).

## Benchmark Harnesses

| Command | Harness | Purpose |
|---|---|---|
| `npm run benchmark` | `benchmarks/run.mjs` | deterministic suite |
| `npm run benchmark:real` | `benchmarks/run-real.mjs` | live/real inputs |
| `npm run benchmark:suite` | `benchmarks/cli.mjs` | CLI-invoked suite |
| `npm run bench:validation` | `benchmarks/run-validation.mjs` | validation benches |

Benchmarks are deterministic by default; `run-real.mjs` is the only live path and
must not be required for the RC1 gate.

## Reproducibility Rules

- Deterministic benches MUST be runnable offline and produce comparable output.
- Live benches MUST be clearly separated and never gate CI.
- A benchmark result is only comparable to another result produced by the same
  harness, same scenario set, and same proxy.

## RC1 Gate Interaction

`npm run gate` (`scripts/release-gate.mjs`) aggregates sub-gates; benchmark
comparability is a supporting signal, not a substitute for `npm test`. The gate is
the RC1 verdict; benchmarks explain the numbers behind it.
