# Design: prompt-eval-correctness-gate

## Context

`evaluateScenario(scenario, output)` produces
`{ scenarioId, severity, passed, evaluable, mandatoryPassed, criteria[] }`.
`aggregateMetrics` correlates verdicts to criteria **by index** and derives
`mandatoryCompliance`, `criticalRegressions`, `targetChecksPassed`,
`evaluableCount`. `run.mjs` builds `run.json` (schema `wam.prompt-eval.run/1`)
and a thin `report.json`. `compare.mjs` diffs prompt hashes and classifies.

## Goals / Non-Goals

**Goals**
- Make a non-evaluable mandatory criterion fail-closed.
- Make `report.json` a self-contained, auditable artifact.
- Make comparison explicit and reject incompatible runs.
- Guarantee these via unit + CLI end-to-end tests.

**Non-Goals**
- No semantic/LLM judging (stays deterministic and offline).
- No change to suite criteria content or prompt files.
- No change to the frozen-hash determinism contract.

## Decisions

- **Fail-closed rule lives in `evaluateScenario`.** Define
  `requiredVerdicts = verdicts.filter((v, i) => criteria[i].required)`.
  `mandatoryPassed = requiredVerdicts.length > 0 && requiredVerdicts.every(v => v.evaluable && v.passed)`.
  `passed = mandatoryPassed && evaluableVerdicts.every(v => v.passed)`.
  A required criterion that is not evaluable therefore fails the scenario.
  `evaluable = requiredVerdicts.some(v => v.evaluable)` (a scenario with no
  evaluable *required* criterion is not evaluable, so it can never contribute
  an `IMPROVED` decision).
  - Alternative (leave `passed`, rely on metrics): rejected — the result
    contract must be unambiguous for every consumer.

- **Comparison coverage guards.** 
  `assertCoverageMatch` verifies that both runs cover the same set of scenario IDs.
  If either run is interrupted/partial (empty `details`), the coverage check is skipped, 
  allowing the comparison to proceed so `classify` can yield `INCONCLUSIVE`.
  If both have details but differ in scenario sets or required criterion IDs per scenario, 
  a `coverage mismatch` error is thrown.

- **Metrics stay index-correlated but fail-closed.** `aggregateMetrics` keeps
  correlating `verdicts[i]` to `criteria[i]`; for a required criterion it counts
  compliance only when `evaluable && passed`, and it marks the scenario failed
  when any required criterion is `!evaluable || !passed`. `criticalRegressions`
  counts failed critical scenarios (unchanged threshold: `SEVERITIES[0]`).

- **Report provenance.** `report.json` embeds the same `details` already
  produced for `run.json` (scenario id, severity, passed, evaluable,
  per-criterion `{ criterionId, kind: oracle.kind, required, passed, evaluable,
  evidence }`). Single source: build `details` once, reuse for both artifacts.
  The core payload stays timestamp-free for byte-identical repeats.

- **Explicit comparison.** `compareRuns(baselineRun, candidateRun, { label } = {})`
  resolves the label: use `options.label` if given; else the single label; else
  throw (`ambiguous`). Then it must reject, with descriptive errors:
  suite id/version mismatch, configHash mismatch, and scenario/criterion
  coverage mismatch (same scenario ids, and for each, the same set of
  `required` criterion ids). `equivalentConfig` is computed, not hardcoded.

- **Fix `oracle.kind` reads** in `run.mjs` (must-not guard + report kind).

## Risks / Trade-offs

- [Tightening `passed` may flip previously-"passing" fixtures to failing] →
  Intended; fixtures and tests are updated together and the change to
  `outputs/*` is limited to what the fail-closed rule requires.
- [Adding scenarios to `report.json` changes its size/shape] → No consumer
  depends on `scenarios` being empty; `report.test.mjs` is updated to require
  provenance.
- [Rejecting coverage mismatch could break latent calls] → Only
  `prompts-compare.mjs` calls `compareRuns`; it already passes comparable runs.

## Migration Plan

Localized, additive-to-contract change; rollback = revert the commit. No data
migration; `run.json` schema is unchanged.
