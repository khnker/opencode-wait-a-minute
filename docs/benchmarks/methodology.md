# Benchmark methodology — input-token savings

The benchmark reports **three distinct figures** instead of a single ambiguous
"token reduction" number. A single figure hides the cost WAM itself adds, which
can make a net regression look like a saving. All three are percentages of the
baseline input tokens for the same turns.

| Metric | Key | Meaning |
| --- | --- | --- |
| Context reduction | `context_reduction` | Raw saving from reconstructing context: `baselineInputTokens - wamInputTokens`. Measured **before** WAM overhead. |
| WAM overhead | `wam_overhead` | The cost WAM itself adds to the request (`wamOverheadTokens`), as a share of baseline input. |
| Net input savings | `net_input_savings` | The actual gain after paying for WAM: `context_reduction - wam_overhead`. **May be negative.** |

## Ablation formula (source of truth)

`benchmarks/evaluation/ablation.mjs` defines the canonical relation:

```
netInputSavings = baselineInputTokens - (wamInputTokens + wamOverheadTokens)
```

Equivalently, in percentage-of-baseline form:

```
context_reduction  = (baselineInputTokens - wamInputTokens) / baselineInputTokens * 100
wam_overhead       =  wamOverheadTokens / baselineInputTokens * 100
net_input_savings  = (baselineInputTokens - wamInputTokens - wamOverheadTokens) / baselineInputTokens * 100
```

`net_input_savings` is the only figure that answers "did WAM actually help?".
`context_reduction` alone must never be presented as the benefit, because it
ignores how much context WAM injects to do its job.

## Where the metrics live

- `benchmarks/evaluation/metrics.mjs` — emits `context_reduction`,
  `wam_overhead`, `net_input_savings` (percentages, 2 decimals) from
  `results[].totals.wamTokens/baselineTokens` plus `r.wamOverheadTokens`
  (defaulting to `0` when absent).
- `benchmarks/reporters/rc1-report.mjs` — the `empiricalReal` block of
  `metrics.json` carries `contextReduction`, `wamOverhead` and
  `netInputSavings` (raw token counts). The `wamOverheadTokens` total is sourced
  from the real report totals and per-run metrics.

## Notes

- The legacy `TokenReductionPct` key is removed: it conflated raw context
  reduction with net savings and was routinely misread as a benefit.
- Provider prompt-caching figures are billing/throttling behaviour, **not**
  context reduction, and are reported separately with an explicit caveat (see
  the RC1 evidence report, section C).

## Three evidence classes

The RC1 bundle keeps three evidence classes strictly separate. No merged figure
is produced.

| Class | Source | What it measures |
| --- | --- | --- |
| `internalDeterministic` | `benchmarks/validation/*` | Snapshot equivalence, fast-path count, context rebuilds on a deterministic harness. |
| `empiricalReal` | `benchmarks/run-real.mjs` (dry-run by default; a credentialed run uses the OpenAI-compatible provider) | Real-harness token counts, WAM overhead, net input savings. May be negative (dry-run) or positive (real provider). |
| `externalEvidence` | External corpus metadata | Third-party evidence, reported separately and never combined. |

## Token accounting

Source: `src/skills/engine.js`.

- `estimateTokens(text) = Math.ceil(text.length / 4)` — a cheap chars/4 proxy. It
  is deliberately NOT a real tokenizer: it is deterministic, dependency-free, and
  used for relative comparisons and budgets, never for billing.
- `cavemanify(text)` removes filler phrases, collapses repeated spaces/tabs, and
  collapses 3+ blank lines to 2 before measurement. Reduction claims must state
  whether they are measured before or after `cavemanify`.
- Budgets consume `estimateTokens` (e.g. `DEFAULT_VERIFICATION_BUDGET.maxTokens`).
  A budget breach is a comparison against this proxy, not a provider count.

Rule: any documented "% token reduction" MUST be computed with the same proxy on
both sides. Never mix provider token counts with `estimateTokens`.

## Harnesses

| Command | Harness | Purpose |
| --- | --- | --- |
| `npm run benchmark` | `benchmarks/run.mjs` | Deterministic suite |
| `npm run benchmark:real` | `benchmarks/run-real.mjs` | Real/dry-run suite |
| `npm run benchmark:suite` | `benchmarks/cli.mjs` | CLI-invoked suite |
| `npm run bench:validation` | `benchmarks/run-validation.mjs` | Validation harness |
| `npm run report:rc1` | `benchmarks/reports/generate-rc1.mjs` | RC1 evidence bundle |

## Reproduction

```bash
# Deterministic bundle (no provider required)
npm run report:rc1

# Full local RC1 (requires a real provider; see docs/development/release.md)
npm run rc1
```

The bundle is written to `benchmarks/reports/rc1/` and is content-hashed via
`manifest.json`, so every published figure traces back to the run that produced
it.
