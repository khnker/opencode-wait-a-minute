# Skill Pressure Testing
## ADDED Requirements
### Requirement: Standard pressure scenario
The system MUST define a standard pressure scenario format and a per-skill test layout
`tests/{scenarios,baseline,expected}`.
#### Scenario: Important skill without scenarios
- **WHEN** a skill is marked important but has no scenario
- **THEN** it is `UNVERIFIED`

### Requirement: Baseline vs skill-enabled comparison
The harness MUST run a scenario without the skill (baseline) and with the skill, and MUST
compare both behaviors.
#### Scenario: Without skill fails
- **WHEN** the baseline run is executed
- **THEN** the undesired behavior (failure mode) is recorded
#### Scenario: With skill succeeds
- **WHEN** the skill-enabled run is executed
- **THEN** the desired behavior is observed and evidenced

### Requirement: Evidence, not appearance
A scenario MUST NOT be considered passed because the agent appears to obey; it MUST
produce evidence through the verification model.
#### Scenario: Text-only obedience
- **WHEN** a skill-enabled run produces no evidence
- **THEN** the skill remains `UNVERIFIED`

### Requirement: Reproducible scenarios benchmark and regress
Reproducible scenarios MUST register in the benchmark, and a skill modification that
flips a scenario result MUST be reported as a regression failure.
#### Scenario: Skill edit regresses
- **WHEN** a skill is modified and a previously passing scenario fails
- **THEN** a regression failure is reported
