# Design: Skill TDD / Pressure Scenarios
## Loop
PRESSURE SCENARIO -> BASELINE -> SKILL -> EXECUTION -> VERIFICATION -> REGRESSION
## Layout
skill/
  SKILL.md
  tests/
    scenarios/   # inputs that pressure the agent
    baseline/    # recorded behavior WITHOUT the skill (failure mode + rationalization)
    expected/    # required behavior WITH the skill + evidence
## Comparison
- baseline: undesired behavior recorded
- skill-enabled: desired behavior recorded with evidence
- Evidence uses the CH-05 verification model; TEXT obedience is never evidence.
## States
A skill is `UNVERIFIED` until a scenario passes with evidence.
## Benchmark
Reproducible scenarios register into the existing `benchmark-scenarios` suite.
## Regression
Changing a skill re-runs its scenarios; a flipped result is a regression failure.
## Decisions
- Pressure scenarios are the unit of proof for a skill, mirroring TDD.
