# Design: prompt-eval-judging-calibration

## Context

- Current evaluator (`benchmarks/quality/prompt-eval/deterministic.mjs`) scores
  responses using literal regex oracles (`includes-all`, `includes-any`,
  `excludes-any`, `matches`, `not-matches`) with no ground-truth baseline.
- Baseline scores 0% across all suites: either the oracles are wrong, the model
  outputs don't match oracle expectations, or both. There is no way to tell.
- No frozen gold fixtures exist; no inter-rater reliability measurement; no
  Cohen's κ or precision/recall tracking.
- The 4 policy suites (verify, scope, simplify, delegation) each contain 1–2
  scenarios with a single trial, making statistical assessment impossible.

## Goals / Non-Goals

**Goals:**

- Produce a frozen, versioned gold set: baseline raw outputs + pass/fail labels
  with rationale for every scenario×criterion.
- Implement Cohen's κ computation (per-criterion, per-suite, overall) comparing
  oracle judgments against gold labels.
- Add a calibration gate: fail if κ thresholds are not met.
- Recalibrate oracles based on observed disagreements (prefer affirmative /
  structured checks over brittle regex exclusions).
- Write deterministic `calibration.json` (no timestamps) for CI gating.

**Non-Goals:**

- No LLM-judge introduction.
- No new scenarios, variants, or multi-scenario corpus expansion.
- No latency / cost benchmarking changes.
- Active prompts remain untouched.
- Second independent annotator (inter-rater reliability) is deferred to Phase 2.

## Decisions

- **Gold set capture strategy.** Run the existing evaluator with the baseline
  arm (active prompts) at temperature 0 to capture raw model outputs. Freeze
  these outputs as immutable JSON fixtures under a `gold/` subdirectory. The
  single-annotator labels are authored alongside the fixtures with explicit
  provenance notes documenting the provisional nature.
- **Cohen's κ implementation.** Pure JS with no dependencies. κ = (p₀ - pₑ) /
  (1 - pₑ) where p₀ = observed agreement and pₑ = expected agreement by chance.
  Computed per-criterion (across all scenarios in that criterion) and
  per-suite (across all criteria in that suite), plus overall. The contingency
  table is built from oracle judgment vs gold label for each scenario×criterion
  pair.
- **Gate thresholds.** Overall κ ≥ 0.6 (moderate agreement floor), per-criterion
  κ ≥ 0.4 (slight-to-moderate floor), zero false positives on
  negation/compliant pairs (a compliant answer must never be flagged as a
  violation). Non-zero exit on gate failure.
- **Oracle recalibration approach.** For criteria where oracle disagrees with
  gold (false positive or false negative), replace brittle `excludes-any` with
  affirmative patterns that check for the presence of specific evidence
  markers. Adversarial pairs (compliant-reject vs violating-endorse) are
  retained as regression tests.
- **Oracle recalibration outcome (task 4).** Calibration against the frozen
  gold set (`v1-provisional`) surfaced five false negatives (oracle=fail,
  gold=pass) and zero false positives: `delegation.missing-evidence.keep-pending`,
  `scope.requirement-conflict.indirect-changes`,
  `scope.requirement-conflict.preserve-requirement`,
  `simplify.coupling-tradeoff.simplest-behavior-preserving`, and
  `verify.environment-failure.record-failure`. Each was widened to a robust
  affirmative `includes-any` (bilingual, matching the Spanish baseline outputs)
  or, for `preserve-requirement`, tightened so the `not-matches` guard only
  fires on an asserted shortcut ("shortcut **is to** drop") and not on a
  rejected one ("rejecting the shortcut to drop"). The brittle single-value
  `matches` oracle for `simplest-behavior-preserving` became an affirmative set
  (`simplest`, `behavior-preserving`, `preserve`, `keep the modules separate`,
  ...). Overall κ moved 0.34 → 1.0 with precision held at 1.0 and zero
  negation-guard false positives; no gold labels or raw outputs were edited.
  Because suite oracles changed, `baselines/*.json` were re-frozen and verified
  byte-stable across two freeze runs.
- **Calibration.json format.** Deterministic JSON (stable key order, 2-space
  indent, no timestamps) containing: suite-level and criterion-level κ,
  precision, recall, F1, false positive/negative counts, and gate verdict.
- **Gold fixture versioning.** Fixtures include a `gold-version` field (e.g.
  `v1-provisional`) and a `provenance` object documenting the annotator
  identity, date, and single-annotator limitation.

## Risks / Trade-offs

- [Single-annotator labels may be biased] → Mitigated by explicit provisional
  labeling and Phase 2 plan for independent second annotator. Cohen's κ vs a
  single annotator measures oracle↔gold agreement, not inter-rater reliability.
- [n=1–2 per suite limits statistical power] → Phase 1 explicitly targets
  judging validity, not statistical significance. κ thresholds are conservative
  floors; higher n will tighten confidence in Phase 2+.
- [Oracle changes may break downstream tooling] → Existing adversarial
  regression tests remain green; any oracle modification is validated against
  both gold fixtures and regression pairs.
- [Pure-JS κ implementation edge cases] → Handle zero-denominator (perfect
  disagreement or perfect agreement) gracefully with documented fallback.

## Validity

- **The reported κ is IN-SAMPLE — an upper bound, not a generalization
  estimate.** The oracle recalibration in task 4 was tuned on the exact same
  N=14 gold pairs (`v1-provisional`) it is then scored against. Because the
  oracles were fitted to this set, agreement is measured on the training data:
  κ=1.0 holds by construction on these pairs and says nothing about unseen
  outputs. It is usable as a **regression floor** (it fails if a future edit
  regresses oracle↔gold agreement) but MUST NOT be cited as proof of judge
  quality or generalization.
- **Pre/post recalibration (same gold set, same pairs).** Overall κ
  0.34 → 1.0; precision 1.0 → 1.0 (unchanged); recall 0.545 → 1.0. No gold
  labels, rationales, or raw outputs were edited during recalibration — only
  oracle patterns changed. This is precisely why in-sample κ rose without any
  change to the ground truth.
- **Requirement before treating κ as a generalization estimate.** A held-out
  gold set and/or a second independent annotator (Phase 2, deferred; see
  Non-Goals) is REQUIRED before κ can be read as generalization. Until then,
  every calibration artifact carries an explicit `scope: "in-sample"` marker so
  downstream consumers cannot mistake the metric for out-of-sample evidence.

### Post-calibration live re-run

After oracle recalibration, the live harness was re-run end-to-end:

- Command: `node scripts/prompts-live.mjs --suite all`
- Model `cost-saver`, `temperature: 0`, `trials: 1` (recalibrated oracles).
- Evidence: `benchmarks/results/live-2026-10-13T21-10-35-453Z/live-summary.json`
  (gitignored). Pre-calibration reference run: `benchmarks/results/live-manual/`.

Suite pass-rate transitions (baseline → candidate) and live decision:

| Suite | Variant | pass (baseline → candidate) | Decision |
|-------|---------|-----------------------------|----------|
| delegation | D1 | 0% → 100% | IMPROVED |
| scope | S1 | 100% → 100% | NO_CHANGE |
| simplify | P1 | 100% → 0% | REGRESSION (veto=true) |
| verify | V1 | 50% → 100% | IMPROVED |

Two corrections the recalibrated oracles forced on the earlier live run:

- **Scope S1 was mislabelled.** Pre-calibration the same suite read `0% → 0%`
  yet was reported as `IMPROVED` (a false positive). With recalibrated oracles
  it reads `100% → 100%` and the decision is correctly `NO_CHANGE`.
- **Simplify P1 is a critical regression.** Candidate pass falls `100% → 0%`,
  decision `REGRESSION` with `veto=true` — a candidate that cannot be promoted.

`npm run benchmark:real` was also re-run successfully after loading `.env`
(`WAM_BENCH_BASE_URL`): `context_reduction` 56.12%, latency mean baseline
63.3 ms vs wam 62.2 ms. `benchmark:real` **requires `.env` to be loaded**.

Active prompts (`prompts/policies/*.md`, `prompts/injections/*`) remain
UNCHANGED and no variant is promoted.

- **Supersedes the archived residual-uncertainty note.** The archived
  `2026-10-13-prompt-policy-experiment-pack` decision (`decision.md`, "Residual
  uncertainty (explicit)") states the harness "carries no live usage data" — that
  note is now stale: live prompt data exists (real latency instrumentation + live
  variant harness landed in commit `f16a7d1`, plus this post-calibration
  re-run), so this section supersedes it.
