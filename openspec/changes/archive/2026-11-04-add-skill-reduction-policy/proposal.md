# Change: Add skill reduction policy

## Why

WAM skills grow by accretion: explanations, examples, and constraints accumulate, and
editing by character count cuts behavior instead of cost. The repository needs one
authoritative reduction method that preserves activation, decisions, constraints, and
failure handling while lowering real context load.

## What Changes

- Add a concise `Skill reduction` section to `skills/writing-for-agents/SKILL.md`.
- Put the full contract, general rules (`RED-01`..`RED-10`), type-specific checklists,
  severity levels (`R0`..`R5`), and validation dimensions in
  `skills/writing-for-agents/references/skill-reduction.md`.
- Keep the policy in `writing-for-agents` only; do not copy it into every skill.
- Add a documentation regression test that guards the pointer, contract, rule IDs, and
  type/severity/validation coverage.

## Impact

- Affected specs: `skill-maintenance`
- Affected files: `skills/writing-for-agents/SKILL.md`,
  `skills/writing-for-agents/references/skill-reduction.md`,
  `tests/unit/writing-for-agents-reduction.test.mjs`
- Runtime behavior is unchanged; this is maintainer guidance, loaded on demand.
