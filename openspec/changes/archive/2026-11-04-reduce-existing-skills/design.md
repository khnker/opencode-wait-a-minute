# Design: Reduce existing skills

## Research

- Inventory of bundled skills and their types from `skills/*/SKILL.md`.
- Authoritative policy: `skills/writing-for-agents/SKILL.md` and
  `skills/writing-for-agents/references/skill-reduction.md`
  (`RED-01`..`RED-10`, `R0`..`R5`).
- Type-specific reduction postures (router, engineering, diagnostic, verification,
  architecture, UI, prototype, handoff, meta-skill) from the same reference.
- Existing regression suites for discovery, routing, injection, and craftsman content.

## Alternatives considered

1. **Character cap per skill vs behavior-based reduction.** Chosen: behavior-based.
   A cap would delete decision rules and leave prose; the policy's validation dimensions
   (activation, precision, constraints, coverage, independence, regression, token cost)
   are the acceptance criteria.
2. **Reduce only the largest files vs audit all.** Chosen: audit all, apply `R0` where a
   skill is already compact. Skipping small files hides duplication with larger skills.
3. **Consolidate/remove overlapping skills now vs per-skill reduction first.** Chosen:
   per-skill `R1`..`R3` only. Consolidation (`R4`) and removal (`R5`) need ownership and
   behavior evidence; this change keeps the skill set stable.
4. **Rewrite from scratch vs surgical pruning/compression.** Chosen: surgical edits.
   Rewriting risks losing constraints and makes review harder; `R1`/`R2` preserve
   decisions and allow a meaningful diff.
5. **Free-form validation vs a manifest.** Chosen: a manifest of max sizes and preserved
   markers plus the full suite. It provides RED-10 evidence without pretending a textual
   test proves semantic quality.

## Approach

- Group skills by type, apply the posture from the reference, and keep the skill's
  unique responsibility.
- Preserve frontmatter `name`; sharpen `description` only when activation is unclear.
- Remove sections that explain known theory, restate a command the project exposes, or
  repeat a concept already present in the same skill or a sibling with a distinct owner.
- Keep code blocks that are executable or encode a decision; drop illustrative blocks
  that merely restate the rule.
- Record each skill's before/after byte count and the decision markers retained.
- Add `tests/unit/skill-reduction-invariants.test.mjs` with a manifest of max sizes and
  required markers; run targeted tests, full suite, OpenSpec validation, build, and
  `dist/` load-check.

## Risks / limitations

- Aggressive router reduction can remove context that only appears in rare branches;
  keep activation/exclusion rules and validate routing tests.
- Diagnostic and verification reductions can hide rigor; their rules stay conservative
  and keep the full loop order.
- UI skills overlap; this change removes duplication but does not merge ownership. A
  later `R4` change can consolidate once the authoritative owner per dimension is agreed.
- The manifest is structural; RED-10 still requires representative execution evidence
  for future semantic changes.
