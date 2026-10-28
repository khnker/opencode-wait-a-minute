# Spec: Dialogue state machine

## ADDED Requirements

### Requirement: Observations are typed and validated

The system MUST normalize and validate every dialogue observation before it
reaches the reducer.

#### Scenario: Invalid intent

- **GIVEN** an observation with intent `NOT_REAL`
- **WHEN** it is normalized
- **THEN** the intent becomes UNKNOWN
- **AND** validation reports the invalid value

### Requirement: Stage transitions are deterministic

The system MUST derive the dialogue stage from the previous state, the
observation and the task state. The LLM MUST NOT set the stage directly.

#### Scenario: Execution before approval

- **GIVEN** a CONTRACTING task
- **WHEN** the observation intent is EXECUTE
- **THEN** the stage remains CONTRACTING
- **AND** the action requests contract approval

### Requirement: Completion requires evidence

The system MUST NOT transition to COMPLETED unless every requirement is
verified with evidence.

#### Scenario: Claim without evidence

- **GIVEN** a VERIFYING task with a pending requirement
- **WHEN** the user claims completion
- **THEN** the stage stays VERIFYING
- **AND** the action is BLOCK_COMPLETION

### Requirement: Dictionary is keyed by state

The system MUST key cached observations by normalized message and state
signature, so the same text can mean different things in different stages.

#### Scenario: Approval versus answer

- **GIVEN** the message `sí` under `CONTRACTING|contract_approval`
- **WHEN** it is cached and replayed under `ELICITATION|clarification`
- **THEN** the two entries do not collide

### Requirement: Meta messages do not create work

A status or restart check MUST be observed as META and MUST NOT create
requirements or arm the completion gate.

#### Scenario: Restart status

- **GIVEN** the message `reiniciado ve si esta ok` with no active task
- **WHEN** it is observed and reduced
- **THEN** the intent is META
- **AND** the stage stays IDLE
- **AND** no contract requirements are created
