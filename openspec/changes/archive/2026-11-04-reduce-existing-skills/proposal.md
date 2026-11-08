# Change: Reduce existing skills with the reduction policy

## Why

The bundled skills were written independently and now overlap in explanations, examples,
and restated environment details. WAM has a single reduction policy in
`writing-for-agents`; apply it to the existing skills instead of maintaining ad-hoc
character limits.

## What Changes

- Audit every bundled skill and assign a reduction level (`R0`..`R3`; no consolidation or
  removal in this change).
- Apply type-aware reductions: routers aggressively, engineering moderately, diagnostic
  and verification conservatively, architecture selectively, UI after consolidation,
  prototypes and handoff lightly, meta-skills with semantic validation.
- Preserve activation, decision rules, constraints, failure handling, and important edge
  cases; remove no-ops, duplication, explanatory prose, redundant examples, and
  environment details the agent can discover.
- Record before/after character counts and the behavior markers preserved per skill.
- Add a regression manifest that guards the reduced sizes and the key behavior markers.

## Impact

- Affected specs: `skill-maintenance`
- Affected files: `skills/*/SKILL.md` (except the authoritative
  `writing-for-agents` policy), `openspec/changes/reduce-existing-skills/`,
  `tests/unit/skill-reduction-invariants.test.mjs`
- No runtime behavior is added; skills remain loaded by the existing discovery/registry.
