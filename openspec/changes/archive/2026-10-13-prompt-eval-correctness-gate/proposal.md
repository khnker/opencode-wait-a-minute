# Proposal: prompt-eval-correctness-gate

## Why

The prompt-quality evaluator now executes real evaluations, but three
correctness defects make its verdicts untrustworthy for prompt decisions
(all reproduced against the current `main`):

1. **Missing evidence is reported as a pass.** `evaluateScenario`
   (`deterministic.mjs:145-166`) computes `passed` only over *evaluable*
   verdicts. A `required: true` criterion that cannot be evaluated (empty
   output, malformed/unknown oracle, invalid regex) is dropped from both
   `evaluableVerdicts` and `mandatoryVerdicts`, so a scenario with a mandatory
   un-evaluable criterion plus one passing optional criterion returns
   `passed: true` (verified empirically).
2. **`report.json` has no scenario provenance.** `run.mjs:186` writes
   `{ runId, labels, scenarios: [] }`. The full evidence lives only in
   `run.json`, so the generated report cannot be audited on its own.
3. **Comparison relies on an implicit label convention.** `compare.mjs:12-13`
   blindly takes `labels[0]`; the data contract allows multiple labels and the
   comparator neither selects a label explicitly nor rejects runs that cover
   different scenario/criterion sets.

Additionally, the oracle refactor left two dead reads in `run.mjs`:
`crit.kind === 'must-not'` (`:153`) and `kind: …criteria.find(...).kind`
(`:159`) reference a `criteria[].kind` that no longer exists (it is now
`oracle.kind`), so the must-not guard never fires and the reported criterion
`kind` is always `undefined`.

These are blockers for using evaluator output to judge prompt changes.

## What Changes

- **Fail-closed mandatory criteria.** A scenario passes only when every
  `required: true` criterion is evaluable AND passed. A required non-evaluable
  criterion forces `passed: false` and is never excluded from the mandatory
  set; `evaluable` is false when no required criterion could be evaluated.
- **Report provenance.** `report.json` carries the evaluated scenarios with
  per-criterion verdicts (id, required, oracle kind, passed, evaluable,
  evidence); it must never emit `scenarios: []`. Serialized core stays
  byte-identical across repeats.
- **Explicit, guarded comparison.** `compareRuns` selects the label explicitly
  (default only when the run has exactly one), and rejects runs whose
  suite/version/config differ or that do not cover the same scenario ids with
  the same required-criteria ids.
- **Fix the oracle-refactor regressions** in `run.mjs` (use `oracle.kind`).
- **End-to-end gate.** A CLI-level test injects a deliberate critical
  regression and asserts the run/compare pipeline yields `REGRESSION` and the
  report explains it; empty outputs and reworded-but-compliant outputs are
  covered.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `prompt-quality-benchmark`: evaluation is fail-closed on mandatory criteria,
  reports preserve per-scenario/per-criterion evidence, and comparison requires
  explicitly compatible runs.

## Impact

- Code: `benchmarks/quality/prompt-eval/{deterministic,metrics,run,report,compare}.mjs`
  and the matching `*.test.mjs`; `scripts/prompts-{eval,compare,report}.mjs`
  only where they surface the report.
- No new dependencies, no network, no LLM judge, no prompt-content changes.
- `report.json` grows (now contains scenarios); `run.json` keeps its schema.
