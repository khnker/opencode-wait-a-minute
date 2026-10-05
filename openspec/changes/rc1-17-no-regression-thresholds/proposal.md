# Change: No-Regression Thresholds

## Why
RC1 needs explicit regression thresholds; live-provider savings variance is a poor release condition.

## What Changes
- Define thresholds: correctness 100%, state equivalence 100%, deterministic savings >= established baseline.
- Do NOT impose a rigid live-provider savings threshold yet.

## Non-goals
- Gating on live-provider savings variance.

## Expected Result
Documented thresholds gate correctness/equivalence/deterministic savings without punishing live variance.

## Validation
- [ ] Thresholds documented.
- [ ] Gate enforces them.
- [ ] Live-provider variance is not a hard gate.

## Program
- RC1 item: RC1-17 (E)
- Priority: P1
