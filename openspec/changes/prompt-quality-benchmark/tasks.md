# Tasks: Prompt-Quality Benchmark

## Phase 1 — schema + suites
- [x] Create OpenSpec change `prompt-quality-benchmark` (proposal/design/tasks/spec)
- [x] Implement `benchmarks/quality/prompt-eval/schema.mjs` (hand-rolled validators, `PromptEvalSchemaError`)
- [x] PQ-001: duplicate scenario id rejected with explicit error
- [x] PQ-002: missing mandatory criterion rejected (not silently skipped)
- [x] Create suites `verify`, `scope`, `simplify`, `delegation` with the 5 required scenarios (severity + must/must-not criteria)

## Phase 2 — snapshot + run
- [x] Implement `snapshot.mjs`: `hashContent`, `freezeRun` (content-hashed frozen records)
- [x] Implement `run.mjs`: `runEvaluation`, `serializeReport`, `invokedDirectly` CLI
- [x] PQ-003: prompt file change alters hash; snapshot identifies new content
- [x] PQ-004: freeze, then modify prompt → comparison uses snapshot, not live file
- [x] PQ-INT-05: deterministic eval path runs to completion with NO API keys / no network

## Phase 3 — evaluators
- [x] Implement `deterministic.mjs` (observable contract evaluator)
- [x] Implement `metrics.mjs` (severity-weighted aggregation)
- [x] Implement `decision.mjs` (IMPROVED|NO_CHANGE|REGRESSION|INCONCLUSIVE)
- [x] Implement `compare.mjs` (snapshot-based comparison)

## Phase 4 — wiring + docs
- [x] Implement `report.mjs` (deterministic MD/JSON reporting)
- [x] Create CLI scripts `prompts-eval.mjs`, `prompts-compare.mjs`, `prompts-report.mjs`
- [x] Wire `package.json` scripts
- [x] Document runs/ layout + gitignore policy in README
