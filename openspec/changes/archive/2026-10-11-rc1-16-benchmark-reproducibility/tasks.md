# Tasks
## Implementation
- [x] Add `npm run bench:validate` rejecting results missing commit, scenario, baseline, WAM, incompatible metrics, or stateEquivalent != true.
- [x] `npm run bench:validate` rejects each invalid case.
- [x] It passes on valid auditable results.
- [x] Evidence is machine-checked.
## Validation
- [x] Run the change's objective validation and paste the output.
  - `node --test benchmarks/validation/audit-results.test.mjs` → `tests 9, pass 9, fail 0` (covers missing commit/scenario/baseline/WAM, `stateEquivalent` false/missing, empty results).
  - `npm run bench:validate` → `{"ok":true,"resultsChecked":8,"errors":[]}`.
- [x] `openspec validate rc1-16-benchmark-reproducibility --strict` passes.
  - `Change 'rc1-16-benchmark-reproducibility' is valid`.
