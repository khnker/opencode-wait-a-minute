# Tasks: implement-prompt-eval-execution

## 1. Recorded outputs & CLI

- [x] 1.1 Add recorded-output fixtures under `benchmarks/quality/prompt-eval/outputs/` for each shipped suite and the `baseline`/`candidate` labels
- [x] 1.2 Add an offline loader that reads the fixture shape `{ [scenarioId]: string }` per `<label>__<suite>.json`
- [x] 1.3 Extend `scripts/prompts-eval.mjs` to accept the outputs (default fixture path) and pass `outputsByLabel` into `runEvaluation`

## 2. Evaluation execution

- [x] 2.1 Add `evaluateScenario(scenario, output)` to `deterministic.mjs` aggregating per-criterion results with `passed`, `evaluable`, and evidence
- [x] 2.2 Wire `runEvaluation` to evaluate every scenario and derive `metrics` (`evaluableCount`, `totalScenarios`, `mandatoryCompliance`, `targetChecksPassed`, `criticalRegressions`) from real results
- [x] 2.3 Populate `details` with one entry per scenario (`scenarioId`, `severity`, `passed`, `evaluable`, `criteria[]`)
- [x] 2.4 Ensure serialized run cores stay byte-identical across repeats (no timestamps/durations)

## 3. Decision guards

- [x] 3.1 `decision.mjs`: return `INCONCLUSIVE` when evaluation data is missing and block `IMPROVED` without per-scenario results
- [x] 3.2 Ensure token savings are never used to offset a failed critical criterion; evidence names scenario + criterion + severity

## 4. Report & tests

- [x] 4.1 Rewrite `report.mjs` to consume the real run-record shape (`labels[*]` objects + per-label `details`)
- [x] 4.2 Rewrite `report.test.mjs` against the real record so `prompts:report` no longer crashes
- [x] 4.3 Add PQ-EXEC-01..05 tests, including a deliberate critical regression that must yield `REGRESSION`

## 5. Validation

- [x] 5.1 `openspec validate --changes` passes for this change
- [x] 5.2 `node --test benchmarks/quality/prompt-eval/*.test.mjs` all green
- [x] 5.3 `node scripts/prompts-check.mjs` stays OK (33 prompts)
- [x] 5.4 Acceptance matrix executed (self-compare → NO_CHANGE; fixed failure → IMPROVED; false DONE → REGRESSION; empty → INCONCLUSIVE; savings+regression → REGRESSION)
