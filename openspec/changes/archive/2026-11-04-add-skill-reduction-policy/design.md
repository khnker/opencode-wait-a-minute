# Design: Add skill reduction policy

## Research

- OpenCode skills documentation — discovery, `SKILL.md`, and supporting files:
  https://opencode.ai/docs/skills/
- Agent Skills specification — portable skill layout and progressive disclosure:
  https://agentskills.io/specification
- Anthropic, effective context engineering for agents — context is finite, retrieval is
  conditional, and attention degrades with irrelevant load:
  https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Prior repository decisions:
  `openspec/changes/add-craftsman-skill/design.md` (full-body injection, token-bound
  skills) and `skills/writing-for-agents/SKILL.md` (pointers, sprawl, negation, pruning).
- User-provided reduction protocol (RED-01..RED-10, type rules, R0..R5, validation).

## Alternatives considered

1. **Full policy in `SKILL.md` vs summary plus reference.** Chosen: summary plus
   reference. The full tables are useful only while reducing a skill; keeping them in
   the always-loaded body adds the same sprawl the policy removes. The body carries the
   contract and a pointer with an explicit activation condition.
2. **Copy rules into every skill vs one authoritative policy.** Chosen: one policy in
   `writing-for-agents`. Copying would violate RED-02 and RED-04 and make future rule
   changes a multi-file edit.
3. **Character thresholds vs behavior-based reduction.** Chosen: behavior-based rules.
   Character caps cut decision rules and keep prose; the user's criterion is preserving
   behavior that changes outcomes.
4. **Prompt-only guidance vs a reduction contract.** Chosen: explicit contract with
   validation dimensions. A checklist makes “shorter” insufficient evidence and forces
   activation/regression checks.
5. **Delete overlapping content first vs consolidate first.** Chosen: consolidate before
   deletion (R4 after R1–R3). Deleting before naming each skill's differential behavior
   loses capabilities and makes ownership ambiguous.

## Approach

- Add a `Skill reduction` section to `writing-for-agents/SKILL.md` with the nine-step
  contract, the type posture summary, the severity order, and a pointer to the reference.
- Add `references/skill-reduction.md` with the complete general rules, per-type
  keep/remove checklists, severity table, validation dimensions, and WAM application
  rule (single source, no per-skill copies).
- Update the skill description so pruning/restructuring activates it.
- Add `tests/unit/writing-for-agents-reduction.test.mjs` to assert the pointer exists,
  the contract steps are present, and the reference retains all rule IDs, type headings,
  severity levels, and validation dimensions.
- Keep runtime code unchanged; the skill is documentation and is loaded by the existing
  skill loader.

## Risks / limitations

- The reference can drift from the summary; the test checks structural coverage, not
  semantic equivalence.
- Type-specific advice is heuristic; RED-10 still requires execution evidence for real
  reductions.
- The policy adds a small amount to the meta-skill body; progressive disclosure keeps
  the full tables out of ordinary skill-writing turns.
