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
