# Spec: Task-conditioned role replacement

## ADDED Requirements

### Requirement: Select a role from the task

The system MUST select a deterministic role from the task objective and requirements.

#### Scenario: Role selection

- **GIVEN** a task with an objective and requirements
- **WHEN** the role is computed
- **THEN** a role from the predefined set is selected

### Requirement: Inject a bounded role instruction

The system MUST inject the selected role as a one- or two-line instruction without duplicating an existing role.

#### Scenario: Role injection

- **GIVEN** a selected role and the current context
- **WHEN** the role is injected
- **THEN** the context receives one bounded role instruction

### Requirement: Feature is configurable and disabled by default

The role replacement MUST be configurable and MUST be disabled by default.

#### Scenario: Default configuration

- **GIVEN** no explicit configuration
- **WHEN** WAM builds the context
- **THEN** role replacement is disabled
