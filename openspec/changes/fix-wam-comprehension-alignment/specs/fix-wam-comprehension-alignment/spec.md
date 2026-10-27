# Spec: WAM conversational comprehension and alignment

## ADDED Requirements

### Requirement: Retain prior conversation context

The system MUST retain prior conversation messages across state transitions and phase changes without message loss.

#### Scenario: Phase transition

- **GIVEN** a conversation with prior turns
- **WHEN** WAM changes phase
- **THEN** the prior messages remain available to the next turn

### Requirement: Validate intent against inferred goals

The system MUST validate user intent against inferred goals to prevent pragmatic misinterpretation and goal deviation.

#### Scenario: Intent mismatch

- **GIVEN** an inferred goal and a new user message
- **WHEN** the message conflicts with the goal
- **THEN** WAM flags the mismatch before executing

### Requirement: Recognize lifecycle stages deterministically

The system MUST recognize lifecycle stages deterministically with explicit confirmation checkpoints.

#### Scenario: Stage transition

- **GIVEN** a task in a lifecycle stage
- **WHEN** the stage changes
- **THEN** WAM requires the configured checkpoint before advancing
