# Proposal: prompt-policy-experiment-pack

## Why

WAM's four behavior policies (`verify`, `scope`, `simplify`, `delegation`)
have no dated, evidence-backed test of whether they actually improve outcomes.
Worse, the current evaluator cannot answer that question reliably: several
`required` criteria use literal `excludes-any` oracles whose terms can appear in
a *correct* answer, so a compliant response is scored as a violation
(false positive):

- `verify.false-done.no-false-done` excludes `["done","verified","completion claim"]`
- `scope.requirement-conflict.no-unrelated-refactors` excludes `["refactor","cleanup","style"]`
- `simplify.coupling-tradeoff.no-loc-only-reuse` excludes `["reduce lines","loc","lines of code"]`
- `delegation.missing-evidence.no-claim-as-evidence` excludes `["success claim","claim as evidence","trusted"]`

Comparing prompt variants on top of these oracles would measure word choice,
not behavior. This change prepares, runs and compares the variants **without
touching the active prompts** and **without replacing the evaluator**.

## What Changes

- **Fix evaluator false positives first.** Make contested criteria
  negation-aware (a compliant answer may name the thing it refuses), add the
  missing adversarial scenario pairs, and add evaluator self-regression tests.
  Freeze a valid baseline only after the oracles are corrected.
- **Version experimental variants.** Add dated variants for `verify`, `scope`,
  `simplify` and `delegation` (V1/S1/P1/D1 style) under an experiments path,
  leaving `prompts/policies/*.md` and `prompts/injections/delegation.md` intact.
- **Comparable experiments only.** Baseline and candidates run with identical
  suite, configuration and coverage; a run records per-scenario verdicts,
  per-criterion verdicts, cost (tokens/latency/failures) and a reproducible
  config hash.
- **Regression veto.** A candidate with a critical regression is rejected even
  if it saves tokens.
- **Documented outcome.** Report which variant wins, what loses, and what
  uncertainty remains before any promotion.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `prompt-quality-benchmark`: negation-aware oracles, adversarial scenario
  pairs, evaluator self-regression tests, and per-scenario/per-criterion/cost
  evidence for experiments.
- `benchmark-methodology`: versioned experimental variants, identical-
  configuration comparison, critical-regression veto, and documented
  promotion outcome.

## Impact

- Code: `benchmarks/quality/prompt-eval/` (oracles, scenarios, run/compare
  evidence) and new `prompts/experiments/**`; no change to active prompts.
- No new deps, offline, deterministic. Active behavior unchanged until a
  winner is explicitly promoted in a later change.
