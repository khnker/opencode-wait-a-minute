# Tasks: Benchmark Evidence & README (CHANGE 04)

## Recon
- [x] Inventory `docs/benchmarks/*` (results, evidence, methodology, limitations, RC1, README)
- [x] Locate README claims (EN `README.md:44-45`, ES `README_es.md:30-31`)
- [x] Confirm `npm run report:rc1` → `benchmarks/reports/generate-rc1.mjs`

## Verify evidence chain
- [x] `69.6%` = `metrics.json.internalDeterministic.totalReductionPct`
- [x] `32.6%` = `real-report.json` `netInputSavings / baselineInputTokens` (60745 / 186364)
- [x] Negative dry-run (`netInputSavings = -225`) documented in `results.md` §B1
- [x] Three evidence classes kept separate (`separationPolicy`)

## Fix
- [x] Add `docs/benchmarks/results.md` + `docs/RC1_VALIDATION.md` links to `README_es.md`

## Verification
- [x] EN/ES claims match their source fields
- [x] `openspec validate benchmark-evidence-and-readme` passes
- [x] Commit (approved: "Ve todo")

## Out of scope
- [ ] Regenerate benchmarks / run real providers (cost + credentials)
