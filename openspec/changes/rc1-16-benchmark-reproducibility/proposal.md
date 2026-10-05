# Change: Benchmark Reproducibility

## Why
Benchmark evidence must be auditable, not a number in the README.

## What Changes
- Add `npm run bench:validate` rejecting results missing commit, scenario, baseline, WAM, incompatible metrics, or stateEquivalent != true.

## Non-goals
- Un-auditable benchmark claims.

## Expected Result
Benchmark evidence is reproducible and rejected when incomplete.

## Validation
- [ ] `npm run bench:validate` rejects each invalid case.
- [ ] It passes on valid auditable results.
- [ ] Evidence is machine-checked.

## Program
- RC1 item: RC1-16 (E)
- Priority: P1
