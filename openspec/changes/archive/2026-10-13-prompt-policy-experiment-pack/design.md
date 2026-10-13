# Design: prompt-policy-experiment-pack

## Context

- Active policies: `prompts/policies/{verify,scope,simplify}.md` (frontmatter +
  bare rules) and `prompts/injections/delegation.md` (referenced by
  `prompts/index.json` → `injection.delegation`).
- Evaluator: `benchmarks/quality/prompt-eval/` — suites
  `{verify,scope,simplify,delegation}.json`, oracle kinds
  `includes-all | includes-any | excludes-any | matches | not-matches`
  (`deterministic.mjs`), run/compare/report/metrics.
- Fixtures: `outputs/baseline__*.json` and `outputs/candidate__*.json`; there is
  no frozen baseline directory yet.

## Goals / Non-Goals

**Goals**
- Remove false positives from literal negation oracles before any comparison.
- Version experimental variants without disturbing active prompts.
- Produce reproducible, comparable evidence and a documented decision.

**Non-Goals**
- No replacement of the evaluator, no parallel prompt catalog.
- No promotion of any variant (that is a later change).
- No LLM judge requirement; structured oracles stay deterministic.

## Decisions

- **Variant storage.** `prompts/experiments/<policy>/<variant>.md`, frontmatter
  mirrors the active policy schema with `status: experimental` and a `variant`
  field. The catalog loader ignores `experiments/`; active policies are
  untouched.
- **Negation-aware oracles.** Keep `excludes-any` only for terms that cannot
  legitimately appear. For contested concepts, a compliant answer may mention
  the refused thing, so replace the literal exclusion with
  `not-matches` on the *affirmative* pattern (e.g. asserting a LOC-only reuse)
  and add an adversarial pair:
  - a compliant answer that explicitly rejects the thing (must pass),
  - a violating answer that endorses it (must fail).
  - Alternative (keep `excludes-any`, add a negation window): rejected as
    fragile and hard to audit.
- **Evaluator self-regression.** Every corrected criterion ships a paired
  test proving compliant-negation passes and violation fails, so the fix cannot
  silently regress.
- **Baseline freeze.** Only after oracles are corrected: record suite id/version,
  config hash and coverage hash as the frozen baseline; comparisons require the
  same trio.
- **Evidence artifact.** `benchmarks/quality/prompt-eval/experiments/<id>/`
  holds `report.json` (per-scenario + per-criterion verdicts) plus `cost.json`
  (tokens, latency, execution failures) and the reproducible config; core
  artifacts stay timestamp-free/byte-identical.
- **Regression veto.** Reuse `compareRuns` semantics: any critical regression
  fails the candidate before token cost is considered.

## Risks / Trade-offs

- [Changing oracles changes scores] → Intended and isolated to Phase 1; the
  frozen baseline is taken *after* the fix, never before.
- [Literal→regex oracles can over-match] → Mitigated by adversarial pairs and
  evaluator self-regression tests.
- [Experiments dir could leak into the catalog] → Loader explicitly ignores
  `prompts/experiments/**`; a test asserts the catalog count is unchanged.

## Migration Plan

Additive: experiments + evaluator fixes only. Rollback = revert the commit.
Active prompt behavior is unchanged until a separate promotion change.
