# Tasks: WAM Audit Regression Gate

## 1. Engine

- [x] 1.1 Compute `noStrategyRatio` from `totals.NO_STRATEGY / totals.tasks` (0 when no tasks).
- [x] 1.2 Evaluate threshold violations for `maxNoStrategyRatio`, `maxLoopedNoProgress`, and `maxAmbiguousMatches`.
- [x] 1.3 Produce `gate: { passed, violations }` from the evaluated totals.

## 2. Config

- [x] 2.1 Load thresholds from `--config FILE` when the flag is present; error if the file is missing or invalid JSON.
- [x] 2.2 Fall back to `.wam-audit.config.json` in the cwd when `--config` is omitted.
- [x] 2.3 Apply defaults `maxNoStrategyRatio=0.9`, `maxLoopedNoProgress=0`, `maxAmbiguousMatches=50` for omitted keys.

## 3. Baseline

- [x] 3.1 Parse `--baseline FILE` and compare `NO_STRATEGY`, `LOOPED_NO_PROGRESS`, `RETRIED_AND_FAILED`, and `ambiguousMatches`.
- [x] 3.2 Record a baseline violation for every metric whose current value is strictly greater than the baseline.
- [x] 3.3 Treat missing baseline keys as `0`.

## 4. CLI exit code

- [x] 4.1 Add `--gate`, `--config`, and `--baseline` to argument parsing in `scripts/wam-audit.mjs`.
- [x] 4.2 Exit `2` when `--gate` is set and `gate.passed` is false; exit `0` when `--gate` is set and the gate passes.
- [x] 4.3 Include `gate` in the aggregate JSON; do not write `.wam` state or open the DB for write.

## 5. Tests

- [x] 5.1 Unit tests: threshold pass, each threshold fail, default vs config vs `--config` precedence.
- [x] 5.2 Unit tests: baseline increase fails, equal/improved metrics pass, missing baseline keys treated as 0.
- [x] 5.3 Integration: `--gate` exit code 2 vs 0; JSON contains `gate.passed` and `gate.violations`.
- [x] 5.4 Guard: gate run does not mutate `.wam` files or the database.

## 6. Docs

- [x] 6.1 Document `--gate`, `--config`, `--baseline`, defaults, and exit codes in the audit README or script header.
- [x] 6.2 Document how to snapshot `wam-audit.json` as a baseline file.
