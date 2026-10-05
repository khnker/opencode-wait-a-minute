# Tasks

## Implementation
- [ ] Add `npm run bench:validate` rejecting results missing commit, scenario, baseline, WAM, incompatible metrics, or stateEquivalent != true.
- [ ] `npm run bench:validate` rejects each invalid case.
- [ ] It passes on valid auditable results.
- [ ] Evidence is machine-checked.

## Validation
- [ ] Run the change's objective validation and paste the output.
- [ ] `openspec validate rc1-16-benchmark-reproducibility --strict` passes.
