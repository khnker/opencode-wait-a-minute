# Proposal: prompt-eval-judging-calibration

## Why

WAM's live policy evaluation is not yet trustworthy: the baseline (active
policy) scores 0% across all 4 suites, which means the test measures whether
the model emits the exact phrases the regex oracles expect (oracle↔language
gap), not actual policy compliance. With n=1–2 scenarios and a single trial,
a 0%→100% swing is uninterpretable. Phase 1 attacks **judging validity** only:
calibrate the evaluator against a frozen gold set before any variant comparison.

## What Changes

- **Frozen gold set.** Capture baseline raw model outputs (temperature 0) for
  the existing 4 suites, freeze them as immutable fixtures, and label each
  scenario×criterion as pass/fail with a short rationale. Labels are
  PROVISIONAL single-annotator (agent-authored); a second independent annotator
  is the next step.
- **Calibration tool.** `benchmarks/quality/prompt-eval/calibrate.mjs` +
  `scripts/prompts-calibrate.mjs` that computes, oracle-vs-gold: per-criterion
  and per-suite Cohen's κ, precision/recall, false positives/negatives, and
  writes a deterministic, timestamp-free `calibration.json`.
- **Gate.** Fail (non-zero exit) if overall κ < 0.6, any per-criterion κ < 0.4,
  or any false positive on negation/compliant pairs.
- **Oracle recalibration.** Adjust existing oracles driven by observed
  disagreements (prefer structured/field-based or affirmative checks over
  brittle free-text regex), keeping adversarial regression tests green.

## Capabilities

### New Capabilities

- `judge-calibration`: frozen gold set definition with provenance/honesty
  labeling, Cohen's κ computation, gate thresholds, and oracle recalibration
  workflow.

### Modified Capabilities

- `prompt-quality-benchmark`: require that criteria be calibrated against the
  gold set (documented κ) and prefer structured/affirmative judging over
  brittle free-text regex.

## Impact

- Code: `benchmarks/quality/prompt-eval/` (gold fixtures, calibrate.mjs,
  calibration.json), `scripts/prompts-calibrate.mjs`.
- No new deps, offline, deterministic. Active prompts unchanged.
- Non-goals (explicitly excluded): no LLM-judge, no new scenarios/variants,
  no latency work, no multi-scenario corpus expansion.
