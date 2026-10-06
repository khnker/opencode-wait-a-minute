# Goal Validation Loop

## ADDED Requirements

### Requirement: Mandatory self-assessment before DONE
The agent MUST perform a self-assessment of whether the implemented change satisfies the user's goal before the task can be marked as DONE.

#### Scenario: Self-assessment required
- **WHEN** the agent is about to mark a task as DONE
- **THEN** the agent MUST have performed a self-assessment of whether the change satisfies the user's goal

### Requirement: Self-assessment recording
The agent MUST be able to record its self-assessment using the `/wam assess-goal` command with a rationale and a status (SATISFIED or NOT_SATISFIED).

#### Scenario: Recording a satisfied assessment
- **WHEN** the agent runs `/wam assess-goal` with status SATISFIED
- **THEN** the assessment SHALL be recorded with the rationale and status

#### Scenario: Recording an unsatisfied assessment
- **WHEN** the agent runs `/wam assess-goal` with status NOT_SATISFIED
- **THEN** the assessment SHALL be recorded with the rationale and status

### Requirement: Gate blocking on missing or unsatisfied assessment
The Completion Gate MUST block the transition to DONE if no self-assessment has been recorded or if the self-assessment status is NOT_SATISFIED.

#### Scenario: Agent unsure blocks DONE
- **WHEN** the agent runs `/wam assess-goal` with status NOT_SATISFIED
- **THEN** the Completion Gate MUST block DONE
- **AND** MUST prompt the agent to clarify the goal or iterate

#### Scenario: Missing assessment blocks DONE
- **WHEN** no self-assessment has been recorded
- **THEN** the Completion Gate MUST block the transition to DONE

### Requirement: Iteration until satisfaction
If the self-assessment is NOT_SATISFIED, the agent MUST iterate on the implementation and reassess until satisfied.

#### Scenario: Iteration leads to satisfaction
- **WHEN** the agent improves the implementation and re-runs `/wam assess-goal` with status SATISFIED after a prior NOT_SATISFIED assessment
- **THEN** the Completion Gate SHALL no longer block on goal validation

### Requirement: Explicit satisfaction confirmation
Only a self-assessment with status SATISFIED MUST allow the Completion Gate to proceed (assuming other gates pass).

#### Scenario: Satisfied allows completion
- **WHEN** the self-assessment status is SATISFIED
- **AND** other gates pass
- **THEN** the Completion Gate MUST allow the task to proceed to DONE
