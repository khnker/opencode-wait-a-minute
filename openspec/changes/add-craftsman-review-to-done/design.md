# Design: Craftsman Review as Part of Done

## Context
`skills/verify/SKILL.md` is loaded before an agent claims DONE and already
lists runtime invariants (V1–V9) and a procedure that ends in the completion
gate. The `craftsman` skill (`skills/craftsman/SKILL.md`) defines engineering
invariants and a **Diff Audit** covering unjustified abstractions, duplication,
coupling, behavioral flags, error causality, invalid states and needless
complexity.

## Research
- Scrum Guide, Definition of Done: https://scrumguides.org/scrum-guide.html
- Martin Fowler, Definition of Done: https://martinfowler.com/bliki/DefinitionOfDone.html
- KISS principle: https://en.wikipedia.org/wiki/KISS_principle
- DRY principle: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself

Common guidance: a Definition of Done is a shared, checkable checklist; quality
review belongs in it, not in an optional post-step.

## Alternatives
1. **Runtime invariant in `completion-invariants.js`** — require a structured
   craftsman-review requirement/evidence for every task. Rejected: persisted
   task state has no review artifact today, so this needs a new evidence type and
   a migration/back-compat path for existing tasks; it also hardcodes a workflow
   policy into a pure state check. Higher cost than the requirement.
2. **AGENTS.md only** — rejected: governs this repository's sessions, not the
   shipped verify skill that users invoke before claiming DONE.
3. **Chosen: extend the verify skill + AGENTS.md + regression test** — the review
   lives where completion is decided, scoped to code changes, with no runtime
   state change. Matches the existing skill-content test pattern.

## Decision
Add V10 to the verify skill, a "Craftsman review of the diff" procedure step, a
completion condition and an anti-pattern; add workflow step 5b to AGENTS.md. The
review is scoped to tasks that changed code so documentation-only completions are
not blocked.

## Risks
- Agents may treat the review as prose-only. Mitigation: it is a blocking
  invariant and a completion condition, and the diff audit checklist is explicit.
- Skill text drift from the craftsman skill. Mitigation: verify names the
  `craftsman` Diff Audit as the source of truth instead of copying its rules.
