# Proposal: implement-prompt-eval-execution

## Why

The prompt-quality benchmark can freeze prompts and compare content hashes,
but it never executes the deterministic evaluator: `runEvaluation` writes
`metrics: {}` and `details: []`, so a comparison has no behavioral evidence
and `IMPROVED` / `REGRESSION` cannot be justified. WAM can catalog and version
prompts, but cannot yet demonstrate that a prompt change improves agent
behavior.

## What Changes

- Wire `runEvaluation` to execute **every** scenario against a recorded output
  and derive `metrics` + `details` from real per-criterion results.
- Add offline, deterministic **recorded-output fixtures** keyed by
  label/suite/scenario (no network, no API keys).
- Add `evaluateScenario(scenario, output)` that aggregates criterion results
  and distinguishes pass / fail / not-evaluable / no-evidence.
- Block `IMPROVED` when evaluation data is missing or incomplete; a missing or
  empty output is never a pass and yields `INCONCLUSIVE`, not `IMPROVED`.
- Guarantee that token savings can never offset a failed critical criterion.
- Add adversarial tests: deliberate critical regression → `REGRESSION`;
  equivalent outputs → `NO_CHANGE`; empty/unrecorded output → `INCONCLUSIVE`.
- Keep the run core byte-identical across repeats (no timestamps/durations).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `prompt-quality-benchmark`: the evaluation requirement now mandates real
  scenario execution. Runs MUST evaluate their scenarios before reporting
  metrics, and decisions MUST be backed by per-scenario, per-criterion,
  per-severity results.

## Impact

- Code: `benchmarks/quality/prompt-eval/{run,deterministic,decision,metrics}.mjs`,
  `scripts/prompts-eval.mjs`, new `outputs/` fixtures, and prompt-eval tests.
- No second prompt catalog, no new release gate, no duplicate benchmark
  infrastructure (`benchmarks/cli.mjs` reused where applicable).
- Offline-only and reproducible in CI; live-model runs remain out of scope.
