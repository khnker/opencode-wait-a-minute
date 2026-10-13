# Tasks: strengthen-prompt-behavior-oracles

## 1. Oracle engine

- [x] 1.1 Extend `evaluateCriterion` to dispatch on `criterion.oracle.kind` (`includes-all`, `includes-any`, `excludes-any`, `matches`, `not-matches`)
- [x] 1.2 Treat missing/empty output and invalid regex as not-evaluable (never passed); keep evidence informative
- [x] 1.3 Update `evaluateScenario` to consume the oracle shape

## 2. Schema

- [x] 2.1 Update `schema.mjs` criterion validation: require `id`, `required`, `description`, and a well-formed `oracle` (`kind` in the allowed set, non-empty `values`)
- [x] 2.2 Update `schema.test.mjs` for the new criterion shape and rejection cases

## 3. Suites & fixtures

- [x] 3.1 Rewrite the criteria of `suites/{verify,scope,simplify,delegation}.json` to structured observable oracles, moving prose intent into `description`
- [x] 3.2 Update `outputs/*` fixtures so compliant outputs use observable evidence (with paraphrases) and the candidate keeps a deliberate critical regression

## 4. Tests

- [x] 4.1 PQ-ORACLE-01: `includes-any` passes on a different accepted phrasing
- [x] 4.2 PQ-ORACLE-02: output equal to the `description` (no observable evidence) fails
- [x] 4.3 PQ-ORACLE-03: `excludes-any` detects a forbidden observable and fails the scenario
- [x] 4.4 PQ-ORACLE-04: `matches` regex passes on structured output and fails otherwise
- [x] 4.5 PQ-ORACLE-05: empty output is not-evaluable (never passed)
- [x] 4.6 Keep change-01 tests green (`PQ-EXEC-01..05`, run/journal/report/decision/compare/metrics)

## 5. Validation

- [x] 5.1 `node --test benchmarks/quality/prompt-eval/*.test.mjs` all green
- [x] 5.2 `openspec validate --changes --strict` passes for this change
- [x] 5.3 `node scripts/prompts-check.mjs` stays OK (33 prompts)
