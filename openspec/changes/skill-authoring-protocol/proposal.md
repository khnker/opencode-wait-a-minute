# Change: Skill Authoring Protocol
## Why
Skills are currently written ad hoc, "because they seem useful". There is no requirement
to observe the behavior a skill is meant to change, which produces overlapping skills,
skills that encode project-specific trivia, and skills that should have been validation.
## What Changes
- Define a formal authoring pipeline:
  IDENTIFY -> PRESSURE SCENARIO -> BASELINE FAILURE -> MINIMAL SKILL -> GREEN ->
  LOOPHOLE DISCOVERY -> REFINE -> VERIFY.
- Define the authoring record (skill / scenario / baseline / implementation / verification).
- Define a taxonomy: `skill`, `workflow`, `reference`, `constraint` (each with a purpose).
- Define exclusion rules: do NOT author a skill for a one-off solution, a mechanical rule
  that belongs to validation, project-specific information, or knowledge already covered.
- Detect duplication against the existing registry before accepting a new skill.
## Non-goals
- Executing the pressure scenarios (CH-02 owns the test harness/format).
- The runtime composition graph (CH-01) or workflows (CH-04).
## Depends on
- `skill-lifecycle-composition` (CH-01): the skill contract a new skill must conform to.
## Expected Result
Every new skill ships with an authoring record proving baseline -> improvement, and the
four artifact kinds are unambiguous. Duplicates are rejected at authoring time.
## Validation
- [ ] `openspec validate skill-authoring-protocol --strict` passes
- [ ] Authoring docs define the record and the taxonomy
- [ ] Duplication check rejects a skill overlapping an existing one
## Program
- Program: Superpowers integration
- Order: 2 of 7
- Priority: P0
