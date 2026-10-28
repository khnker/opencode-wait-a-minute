# Spec: Completion message

## ADDED Requirements

### Requirement: Completion claims always run the gate

The system MUST evaluate the completion gate for any completion claim, even when the intent router classifies the message as conversation.

#### Scenario: Natural completion claim

- **GIVEN** an approved task with all requirements verified
- **WHEN** the user says "listo, terminado"
- **THEN** the completion gate runs
- **AND** the phase becomes DONE

### Requirement: Final completion message is emitted once

The system MUST emit a visible completion summary when the gate allows DONE and MUST NOT repeat it.

#### Scenario: First DONE

- **GIVEN** a task that just transitioned to DONE
- **WHEN** the completion message is emitted
- **THEN** it contains the objective, verified requirement count and evidence

#### Scenario: Repeated DONE claim

- **GIVEN** a task already marked `completionNotified`
- **WHEN** another DONE claim arrives
- **THEN** the completion message is not emitted again
