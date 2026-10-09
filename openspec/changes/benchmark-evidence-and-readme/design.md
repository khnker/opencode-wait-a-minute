# Design: Benchmark Evidence & README (CHANGE 04)

## Evidence chain

| README claim | Source artifact | Field / derivation |
| --- | --- | --- |
| `69.6%` Context Reduction | `benchmarks/reports/rc1/metrics.json` | `internalDeterministic.totalReductionPct = 69.6` |
| `32.6%` Net Input Savings | `benchmarks/results/2026-10-07T19-55-09.328Z/real-report.json` | `netInputSavings / baselineInputTokens = 60745 / 186364 = 32.59%` |
| `10/10` Deterministic Validation | `docs/RC1_VALIDATION.md` + `metrics.json.internalDeterministic` | `snapshotPassed = 10`, `snapshotFailed = 0` |

## Invariants (from `docs/benchmarks/README.md`)

1. Three evidence classes (`internalDeterministic`, `empiricalReal`,
   `externalEvidence`) are reported separately — never merged.
2. `context reduction ≠ token savings ≠ provider cost`.
3. `69.6%` is a deterministic-harness figure, never a real-model saving.
4. The dry-run `netInputSavings = -225` is reported as-is.
5. No provider pricing is applied.

## Decision: verify, do not regenerate

The committed artifacts (`metrics.json`, `real-report.json`) are the source of
truth and already back both figures. Regenerating would require real-provider
credentials and cost, and would not change the documented methodology. CHANGE 04
therefore **locks the traceability** and fixes the ES README parity gap.

## Files touched

- `README_es.md` — add `docs/benchmarks/results.md` and `docs/RC1_VALIDATION.md`
  links (parity with `README.md`).
- `openspec/changes/benchmark-evidence-and-readme/*` — this change.
