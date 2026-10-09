# Change: Skill TDD / Pressure Scenarios
## Why
A skill is only valuable if it demonstrably changes behavior. Today there is no way to
prove that, so skills are trusted on faith. Following Superpowers, skill creation is TDD:
first show the agent fails without the skill, then add the skill, then verify the behavior
changed.
## What Changes
- Define the standard pressure scenario format.
- Define a per-skill test layout: `skill/tests/{scenarios,baseline,expected}`.
- Provide a harness to run baseline (skill disabled) and skill-enabled runs.
- Compare behaviors and require evidence (not "the agent seemed to obey").
- Allow a skill to be marked `UNVERIFIED`.
- Feed reproducible scenarios into the benchmark.
- A modification to a skill MUST be able to trigger a regression failure.
## Non-goals
- Authoring docs and taxonomy (CH-03).
- The workflow engine (CH-04).
## Depends on
- `skill-authoring-protocol` (CH-03).
- `skill-verification-completion` (CH-05) for the evidence model.
## Expected Result
Every important skill has >=1 pressure scenario proving without-skill failure and
with-skill success with evidence, and skill modifications regress when behavior breaks.
## Validation
- [ ] `openspec validate skill-pressure-scenarios --strict` passes
- [ ] A scenario demonstrates baseline failure and skill-enabled success
- [ ] Editing a skill can trigger a regression failure
## Program
- Program: Superpowers integration
- Order: 3 of 7
- Priority: P0
