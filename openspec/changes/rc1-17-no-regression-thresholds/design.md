# Design: No-Regression Thresholds

## Approach
RC1 needs explicit regression thresholds; live-provider savings variance is a poor release condition.

## Scope
- Define thresholds: correctness 100%, state equivalence 100%, deterministic savings >= established baseline.
- Do NOT impose a rigid live-provider savings threshold yet.

## Validation Strategy
- Thresholds documented.
- Gate enforces them.
- Live-provider variance is not a hard gate.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
