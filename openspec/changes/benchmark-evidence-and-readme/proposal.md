# Proposal: Benchmark Evidence & README (CHANGE 04)

## Problem

The README advertises two benchmark figures — **69.6% context reduction** and
**32.6% net input savings** — and the repository ships a large benchmark
infrastructure plus `docs/benchmarks/*`. What was missing was a verified,
traceable link between each advertised figure and its committed evidence, and a
bilingual (EN/ES) pointer to the source of truth.

## Solution

Audit and lock the evidence chain, then record it as a change:

- **69.6%** traces to `benchmarks/reports/rc1/metrics.json` →
  `internalDeterministic.totalReductionPct = 69.6` (deterministic snapshot
  harness, `benchmarks/validation/*`, no provider).
- **32.6%** traces to
  `benchmarks/results/2026-10-07T19-55-09.328Z/real-report.json` →
  `netInputSavings / baselineInputTokens = 60745 / 186364 = 32.59%` (one
  credentialed real-provider run; not part of the RC1 bundle).
- The negative dry-run result (`netInputSavings = -225`) is reported as-is in
  `docs/benchmarks/results.md` §B1.

Add the missing `docs/benchmarks/results.md` / `docs/RC1_VALIDATION.md` links to
the ES README so both languages point to the same source of truth.

## Scope

- `README_es.md` — add evidence links (EN parity).
- OpenSpec artifacts (this change).
- Verification of the evidence chain (read-only).

## Out of Scope

- Regenerating benchmarks or running real providers (cost/time); the existing
  committed artifacts are the source of truth.
- Merging the three evidence classes (explicitly forbidden by the benchmark
  non-negotiable rules).
