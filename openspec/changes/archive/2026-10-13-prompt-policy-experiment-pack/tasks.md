# Tasks: prompt-policy-experiment-pack

## 1. Fix evaluator false positives (do first)
- [x] 1.1 Replace the contested `excludes-any` oracles with negation-aware `not-matches` (affirmative pattern): `verify.false-done.no-false-done`, `scope.requirement-conflict.no-unrelated-refactors`, `simplify.coupling-tradeoff.no-loc-only-reuse`, `delegation.missing-evidence.no-claim-as-evidence`
- [x] 1.2 Keep `excludes-any` only for terms that cannot legitimately appear; document each remaining one
- [x] 1.3 Add evaluator self-regression tests: compliant-negation output passes, violation output fails, for each corrected criterion
- [x] 1.4 Freeze a valid baseline (suite id/version + config hash + coverage hash) only after 1.1-1.3 are green

## 2. Version experimental variants (active prompts untouched)
- [x] 2.1 Create `prompts/experiments/verify/V1.md` from the verify variant contract
- [x] 2.2 Create `prompts/experiments/scope/S1.md`
- [x] 2.3 Create `prompts/experiments/simplify/P1.md`
- [x] 2.4 Create `prompts/experiments/delegation/D1.md`
- [x] 2.5 Ensure the catalog loader ignores `prompts/experiments/**` and add a test asserting the active prompt count is unchanged

## 3. Adversarial scenarios
- [x] 3.1 Add adversarial pairs for false-DONE, environment failure, requirement conflict, coupling trade-off, and delegation-without-evidence
- [x] 3.2 Ensure each pair distinguishes a correct negation (pass) from an infringement (fail)

## 4. Run and compare (identical suite/config/coverage)
- [x] 4.1 Runner accepts a variant id and records per-scenario + per-criterion verdicts, cost (tokens, latency, failures) and a reproducible config hash
- [x] 4.2 Write evidence under `benchmarks/quality/prompt-eval/experiments/<id>/` (`report.json` + `cost.json`), timestamp-free core
- [x] 4.3 Compare baseline vs one variant per family with identical suite/config/coverage
- [x] 4.4 Reject any candidate with a critical regression, even if cheaper

## 5. Decision
- [x] 5.1 Document which variant wins, which loses, and residual uncertainty
- [x] 5.2 Do NOT promote any variant to active in this change

## 6. Validation
- [x] 6.1 `node --test benchmarks/quality/prompt-eval/*.test.mjs` green
- [x] 6.2 `node --test benchmarks/quality/*.test.mjs` and `node --test benchmarks/cli.test.mjs` green
- [x] 6.3 `node scripts/prompts-check.mjs` OK
- [x] 6.4 `openspec validate --all --strict` passes
