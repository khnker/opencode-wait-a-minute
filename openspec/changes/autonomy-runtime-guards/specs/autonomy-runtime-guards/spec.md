# Design: Autonomy Runtime Guards

## ADDED Requirements
### Requirement: Pre-action Guard
Before a GUARDED action executes, the system MUST verify the current task exists, an active experiment references the action (or risk allows autonomous execution), the action is reversible or explicitly authorized, and the blast radius is bounded within taskRoot.
#### Scenario: GUARDED action blocked without authorization
- **WHEN** a GUARDED action is irreversible and has no explicit authorization
- **THEN** the action is blocked and the agent is returned control
### Requirement: Post-action Observation
After a successful GUARDED action, the system MUST capture exit code, changed files (git diff if available), and the result of any follow-up test run, linking the observation to the originating experiment.
#### Scenario: Observation linked to experiment
- **WHEN** a GUARDED action completes successfully
- **THEN** an observation recording exit code and changed files is created and linked to the originating experiment
### Requirement: Failure Handling
A failed mutation MUST NOT auto-retry. The system records the failure as an observation and returns control to the agent, which decides whether to investigate or replan.
#### Scenario: Failed mutation returns control to agent
- **WHEN** a mutation fails
- **THEN** the failure is recorded as an observation and the agent is returned control without automatic retry
### Requirement: Verification Boundary
When phase=VERIFYING, the system MUST NOT allow the agent to treat "implementation exists" as "requirement verified". Evidence collection remains required.
#### Scenario: VERIFYING phase requires evidence
- **WHEN** phase is VERIFYING
- **THEN** "implementation exists" is not accepted as "requirement verified" and evidence collection is required
### Requirement: DONE Protection
DONE is unreachable unless the completion contract is satisfied. Autonomous mode MUST NOT introduce a shortcut around the completion gate.
#### Scenario: DONE blocked without completion contract
- **WHEN** the completion contract is not satisfied
- **THEN** DONE is unreachable even in autonomous mode
### Requirement: Experiment Authorization
A GUARDED action MUST NOT execute autonomously unless an experiment exists linking the action, the experiment is within scope, the action is reversible, and no protected resource is affected.
#### Scenario: Autonomous execution requires reversible action
- **WHEN** a GUARDED action has no linked experiment or is irreversible
- **THEN** autonomous execution is denied