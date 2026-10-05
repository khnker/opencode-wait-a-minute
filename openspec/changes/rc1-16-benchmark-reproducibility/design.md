# Design: Benchmark Reproducibility

## Approach
Benchmark evidence must be auditable, not a number in the README.

## Scope
- Add `npm run bench:validate` rejecting results missing commit, scenario, baseline, WAM, incompatible metrics, or stateEquivalent != true.

## Validation Strategy
- `npm run bench:validate` rejects each invalid case.
- It passes on valid auditable results.
- Evidence is machine-checked.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
