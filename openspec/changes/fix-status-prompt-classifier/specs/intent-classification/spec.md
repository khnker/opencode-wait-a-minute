# Spec: Status prompt classification

## ADDED Requirements

### Requirement: Restart and status checks are conversation

A message that only confirms a restart and asks whether things work MUST be classified as conversation, not as a new task.

#### Scenario: Restart followed by a status check

- **GIVEN** the user says "reiniciado ve si esta ok"
- **WHEN** the intent router classifies it
- **THEN** the lane is CONVERSATION
- **AND** no contract requirements are created

### Requirement: Actionable restart requests remain tasks

A request to restart a concrete component MUST remain a task.

#### Scenario: Restart the server

- **GIVEN** the user says "reinicié el servidor"
- **WHEN** the intent router classifies it
- **THEN** the lane is TASK_NEW

### Requirement: Status questions are conversation

A message that only asks whether something is missing or complete MUST be classified as conversation, not as a new task.

#### Scenario: Ask what is missing

- **GIVEN** the user says "falta algo ?"
- **WHEN** the intent router classifies it
- **THEN** the lane is CONVERSATION
- **AND** no contract requirements are created

#### Scenario: Ask whether the task is complete

- **GIVEN** the user says "¿está listo?"
- **WHEN** the intent router classifies it
- **THEN** the lane is CONVERSATION
- **AND** the dialogue observer reports META

### Requirement: Actionable gap statements remain tasks

A statement that names concrete missing work MUST remain a task.

#### Scenario: Missing implementation work

- **GIVEN** the user says "falta implementar el endpoint"
- **WHEN** the intent router classifies it
- **THEN** the lane is TASK_NEW
- **AND** the dialogue observer reports PROVIDE_REQUIREMENT
