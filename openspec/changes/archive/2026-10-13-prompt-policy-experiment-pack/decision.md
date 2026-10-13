# Decision: prompt-policy-experiment-pack

Status: **NO VARIANT PROMOTED**. Active prompts are unchanged.

This change prepares, runs and compares experimental behavior-policy variants
**without touching the active prompts** and **without replacing the evaluator**.
It is an experiment pack, not a rollout.

## Round 0 — Evaluator correctness (DONE, validated)

Promotion was blocked until the evaluator could be trusted. Round 0 corrected
the false-positive `excludes-any` oracles that would have measured word choice
rather than behavior:

- `verify.false-done.no-false-done`
- `scope.requirement-conflict.no-unrelated-refactors`
- `simplify.coupling-tradeoff.no-loc-only-reuse`
- `delegation.missing-evidence.no-claim-as-evidence`

Each contested criterion now uses a negation-aware affirmative `not-matches`
oracle, so a compliant answer may *name and reject* the refused behavior without
being scored as a violation. Remaining literal `excludes-any` oracles are kept
only for terms that cannot legitimately appear.

Round 0 also added adversarial scenario pairs (compliant negation → pass,
infringement → fail) and evaluator self-regression tests, and froze a valid
baseline (`benchmarks/quality/prompt-eval/baselines/*.json`: suite id/version +
config hash + coverage hash + metrics) **only after** the oracles were green.

Round 0 is complete and reproducibly validated:
`node --test benchmarks/quality/prompt-eval/*.test.mjs` is green, and the frozen
baseline is byte-identical across rebuilds.

## Variants under test

| Variant | Policy      | Path                             |
|---------|-------------|----------------------------------|
| V1      | verify      | `prompts/experiments/verify/V1.md`      |
| S1      | scope       | `prompts/experiments/scope/S1.md`       |
| P1      | simplify    | `prompts/experiments/simplify/P1.md`    |
| D1      | delegation  | `prompts/experiments/delegation/D1.md`  |

The prompt-catalog loader ignores `prompts/experiments/**`; the active prompt
count is unchanged and no variant is exposed as active.

## Experiment harness (this change)

- `scripts/prompts-experiment.mjs` runs one suite + variant
  (`--variant <V1|S1|P1|D1|baseline>`) through the deterministic evaluator.
- Evidence is written under
  `benchmarks/quality/prompt-eval/experiments/<experimentId>/` with a
  deterministic, timestamp-free id derived from
  `suite + variant + configHash + coverageHash`:
  - `config.json` — suite id/version, `configHash`, `coverageHash`,
    evaluator/oracle version, variant id, coverage (scenario ids + required
    criterion ids).
  - `report.json` — per-scenario + per-criterion verdict evidence, same shape
    as `run.mjs`.
  - `cost.json` — `{ tokens, latencyMs, executionFailures, source }`.
- Core artifacts (`config.json`, `report.json`) are byte-identical across
  repeats. Comparison reuses `compareRuns`: identical suite id/version, config
  hash and coverage are required, and a critical regression vetoes a candidate
  **regardless of token/latency savings**.

## Residual uncertainty (explicit)

The deterministic harness evaluates **recorded** outputs. It carries **no live
usage data**:

- **Live token and latency measurement was NOT executed here.** It requires a
  real-LLM-runner environment (actual model invocations + usage accounting) that
  is out of scope for this offline, deterministic change.
- Consequently, every experiment arm recorded in this change emits
  `cost.json` with `tokens: null`, `latencyMs: null`,
  `source: "unavailable"` and a reason. The harness **never fabricates** token or
  latency numbers; the cost dimension is honest but currently empty.
- The behavior verdicts (per-scenario / per-criterion) are real and
  reproducible, but the **cost-savings claim for any variant is unmeasured**.
  No conclusion about cost efficiency can be drawn until the variants are run
  through the real-LLM runner.

## Decision

- **No variant is promoted to active in this change.** `prompts/policies/*.md`
  and `prompts/injections/delegation.md` are untouched.
- The pack is ready to be driven by a real-LLM runner: when live usage data
  exists, re-run each variant, populate `cost.json` from the runner artifacts
  (`source: "run"`), and only then evaluate cost-vs-quality trade-offs under the
  existing regression veto.
