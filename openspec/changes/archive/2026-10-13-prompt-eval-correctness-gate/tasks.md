# Tasks: prompt-eval-correctness-gate

## 1. Fail-closed evaluation
- [x] 1.1 `deterministic.mjs` `evaluateScenario`: compute `requiredVerdicts`; a required criterion that is not evaluable (or fails) forces `passed: false`
- [x] 1.2 `passed` requires `mandatoryPassed` AND all evaluable criteria passing; `evaluable` reflects whether a required criterion was evaluable; keep `mandatoryPassed`
- [x] 1.3 `metrics.mjs` `aggregateMetrics`: count mandatory compliance only for `evaluable && passed`; mark scenario failed on any required `!evaluable || !passed`; keep `criticalRegressions` on `SEVERITIES[0]`

## 2. Report provenance
- [x] 2.1 `run.mjs`: build per-scenario `details` once and write them into **both** `run.json` and `report.json` (no `scenarios: []`)
- [x] 2.2 Fix the oracle-refactor regressions: replace `crit.kind === 'must-not'` and `criteria.find(...).kind` with `oracle.kind` (report per-criterion `kind`)
- [x] 2.3 Keep the serialized core (run.json, report.json) byte-identical across repeats (no timestamps in core)
- [x] 2.4 `report.mjs` (and `scripts/prompts-report.mjs` if it reads the report shape) consumes the per-scenario/per-criterion evidence

## 3. Guarded comparison
- [x] 3.1 `compare.mjs` `compareRuns(baselineRun, candidateRun, { label })`: resolve label explicitly; throw when ambiguous (multiple labels, none given)
- [x] 3.2 Reject suite id/version mismatch, configHash mismatch, and scenario-id / required-criterion-id coverage mismatch with descriptive errors
- [x] 3.3 Compute `equivalentConfig` instead of hardcoding `true`
- [x] 3.4 `scripts/prompts-compare.mjs` forwards an optional `--label`

## 4. Tests
- [x] 4.1 `deterministic.test.mjs`: required non-evaluable criterion => `passed:false`, `evaluable:false` (PQ-CORR-01/02); all required pass => `passed:true` (PQ-CORR-03)
- [x] 4.2 `report.test.mjs`: `report.json` lists every scenario with per-criterion verdicts and a real oracle `kind`; never `scenarios: []` (PQ-CORR-04/05)
- [x] 4.3 `compare.test.mjs`: explicit label; ambiguous label throws; coverage mismatch throws; config/suite mismatch throws (PQ-CORR-06/07/08)
- [x] 4.4 `metrics.test.mjs`: mandatory non-evaluable reduces `mandatoryCompliance` and fails the critical scenario
- [x] 4.5 `cli.e2e.test.mjs`: CLI end-to-end detects a critical regression using real eval/compare CLIs with temp outDir; interrupted/empty candidate never IMPROVED (PQ-CORR-10/11)

## 5. Validation
- [x] 5.1 `node --test benchmarks/quality/prompt-eval/*.test.mjs` all green
- [x] 5.2 `node --test benchmarks/quality/*.test.mjs` and `node --test benchmarks/cli.test.mjs` green
- [x] 5.3 `node scripts/prompts-check.mjs` OK
- [x] 5.4 `openspec validate --all --strict` passes
