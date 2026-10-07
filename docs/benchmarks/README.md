# Benchmarks

This directory documents how WAM measures context reduction and what those
measurements do and do not prove. Read it before quoting any number.

## Documents

- [Methodology](methodology.md) — the three separated metrics and the token
  accounting formulas.
- [Results](results.md) — the RC1 numbers exactly as they appear in
  `benchmarks/reports/rc1/metrics.json`.
- [Limitations](limitations.md) — constraints on interpreting the numbers.
- [RC1 evidence bundle](RC1.md) — how the artifact set is generated and traced.

## Non-negotiable rules

1. **Three evidence classes are reported separately. No merged figure is
   produced.** `internalDeterministic`, `empiricalReal` and `externalEvidence`
   are never combined (`benchmarks/reports/rc1/metrics.json`,
   `separationPolicy`).
2. **`context reduction` ≠ `token savings` ≠ `provider cost`.**
   - `context reduction = baselineInputTokens - wamInputTokens`
   - `wamOverheadTokens = Math.max(0, wamModelInput - contextTokens)`
   - `netInputSavings = baselineInputTokens - (wamInputTokens + wamOverheadTokens)`
   `netInputSavings` may be negative.
3. **The 69.6% figure is a deterministic-harness measurement, not a real-model
   saving.** It must never be quoted as a model cost reduction.
4. **The dry-run net input savings is negative (-225 tokens) and is reported
   as-is.** It is not combined with the 69.6% figure.
5. **Provider pricing is never applied.** Only token counts are reported.

## Current state

| Class | Source | Key figure |
| --- | --- | --- |
| Internal deterministic | `benchmarks/validation/*` | `totalReductionPct: 69.6` |
| Empirical real (dry-run) | `benchmarks/run-real.mjs` | `netInputSavings: -225` |
| External evidence | `wam-rc1-external-evidence` | 6 sources (2/2/2/0) |

The release threshold of a **60% task-relevant context reduction under real model
execution is not measured** by any reproducible harness. It remains a design
target; see [Limitations](limitations.md) and
[Validation Premise](../validation/premise.md).

## Reproduce

```bash
npm run report:rc1
# or
node benchmarks/reports/generate-rc1.mjs
```

## See also

- [Context Management](../claims/context-management.md)
- [Causal Decision Matrix](../validation/causal-decision-matrix.md)
