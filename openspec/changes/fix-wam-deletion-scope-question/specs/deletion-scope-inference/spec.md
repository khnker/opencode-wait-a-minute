# Spec: Fix deletion-scope question

## ADDED Requirements

### Requirement: Do not ask for deletion scope when it is already explicit

The system MUST NOT emit the blocking deletion-scope question when the prompt
already specifies the deletion scope, the target, or a concrete reference.

#### Scenario: Session URL with explicit deletion

- **GIVEN** a prompt containing a session URL and the word "borrar"
- **WHEN** critical uncertainties are extracted
- **THEN** no deletion-scope question is produced
- **AND** the task does not enter ASKING for U1

#### Scenario: Explicit hard delete

- **GIVEN** the prompt "elimina los usuarios con hard delete"
- **WHEN** critical uncertainties are extracted
- **THEN** no deletion-scope question is produced

#### Scenario: Ambiguous deletion still asks

- **GIVEN** the prompt "borra los datos"
- **WHEN** critical uncertainties are extracted
- **THEN** the deletion-scope question is produced
