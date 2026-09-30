# WAM Audit Regression Gate — Design

## Goal

Turn the existing read-only WAM behavior audit into an optional CI gate. Recurrence indicators already computed by `scripts/wam-audit.mjs` are compared against thresholds and an optional baseline; the process fails closed when they exceed limits or worsen.

## Metric computation

The gate consumes the same `totals` object the audit already produces. It does not reclassify tasks.

| Metric | Source | Gate use |
|--------|--------|----------|
| `noStrategyRatio` | `totals.NO_STRATEGY / totals.tasks` (0 when `tasks === 0`) | fail if `> maxNoStrategyRatio` |
| `LOOPED_NO_PROGRESS` | `totals.LOOPED_NO_PROGRESS` | fail if `> maxLoopedNoProgress` |
| `ambiguousMatches` | `totals.ambiguousMatches` | fail if `> maxAmbiguousMatches` |
| `NO_STRATEGY` | `totals.NO_STRATEGY` | baseline: fail if current `>` baseline |
| `RETRIED_AND_FAILED` | `totals.RETRIED_AND_FAILED` | baseline: fail if current `>` baseline |

Threshold checks and baseline checks are independent. Any single violation fails the gate. Each violation is a structured record, e.g. `{ metric, actual, limit, kind: "threshold" | "baseline" }`.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Gate passed (or `--gate` not set; existing audit behavior unchanged). |
| `2` | Gate violation: at least one threshold or baseline regression. |

Other non-zero codes (parse errors, missing files) remain distinct from `2` so CI can tell "regression" from "tool failure".

## Config precedence

Resolved once at process start:

1. `--config FILE` (explicit path; missing file is an error, not a silent fallback).
2. `.wam-audit.config.json` in the cwd, if present.
3. Built-in defaults: `maxNoStrategyRatio=0.9`, `maxLoopedNoProgress=0`, `maxAmbiguousMatches=50`.

Later sources do not overlay earlier ones. A config object may omit keys; omitted keys keep defaults. Unknown keys are ignored.

## Baseline semantics

`--baseline FILE` is a JSON snapshot of a previous aggregate (at minimum the four compared fields). Comparison is strict increase (`current > baseline`); equal counts pass. Missing baseline keys are treated as `0` so a new metric cannot sneak in without being gated. The gate never writes a baseline; operators copy `wam-audit.json` (or a subset) into the baseline path out of band.

`--baseline` without `--gate` still computes `gate` in the JSON but does not change the exit code. `--gate` without `--baseline` evaluates thresholds only.

## Machine-readable result and read-only invariant

The aggregate JSON always includes:

```json
"gate": {
  "passed": true,
  "violations": []
}
```

when `--gate` or `--baseline` is set. `violations` is empty iff `passed` is true. The gate path reuses the audit's read-only DB open and MUST NOT create, update, or delete files under `.wam` or the OpenCode database.
