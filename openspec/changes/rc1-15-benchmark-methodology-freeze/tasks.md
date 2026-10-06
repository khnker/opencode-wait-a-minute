# Tasks
## Implementation
- [x] Formally separate deterministic vs live-provider benchmarks.
- [x] Each result MUST include commit, version, scenario, baselineTokens, wamTokens, savingsTokens, savingsPercent, equivalent, and provider/model when applicable.
- [x] Deterministic and live outputs are separate.
- [x] Every result has the required fields.
- [x] No merged percentage is reported.
## Validation
- [x] Run the change's objective validation and paste the output.
  - `npm run bench:audit` → `benchmarks/reports/rc1/audit.json` written; every record carries commit, version, scenario, baselineTokens, wamTokens, savingsTokens, savingsPercent and equivalent (`provider`/`model` only for `empiricalReal`).
  - `benchmarks/reports/rc1/comparison.json` → `merged: false`; `mergePolicy` states the three evidence classes are reported separately.
- [x] `openspec validate rc1-15-benchmark-methodology-freeze --strict` passes.
  - `Change 'rc1-15-benchmark-methodology-freeze' is valid`.
