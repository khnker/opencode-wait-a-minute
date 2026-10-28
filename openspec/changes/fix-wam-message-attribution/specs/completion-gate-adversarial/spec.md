# Spec: Completion gate — no fabricated user action

## ADDED Requirements

### Requirement: Gate output only on completion claims

The system MUST evaluate the completion gate on every non-trivial turn, but
MUST only emit the gate hold, the LLM validation and the completion
confirmation when the current message is a completion claim.

#### Scenario: Unrelated instruction

- **GIVEN** an APPROVED task with pending requirements
- **WHEN** the user writes "reiniciado, ve si está ok" (not a completion claim)
- **THEN** no completion-gate notice or validation is injected into that
  message

#### Scenario: Completion claim

- **GIVEN** an APPROVED task with pending requirements
- **WHEN** the user writes "listo, terminado"
- **THEN** the gate hold and the validation are injected with the pending list

### Requirement: Requested action reflects the contract

The validation MUST quote the contract objective (falling back to the last user
action) and MUST NOT present a fabricated user utterance.

#### Scenario: Validation text

- **GIVEN** a state whose contract objective is "Refactorizar el parser"
- **WHEN** `buildCompletionValidation(gate, state)` is called
- **THEN** the text contains "Refactorizar el parser"
- **AND** it does not contain `Acción solicitada por el usuario: "Listo, continúa"`

### Requirement: No repeated identical gate

The system MUST NOT emit the same gate notice and validation twice in a row
for the same set of pending requirements. The pending set is persisted with the
task and re-emitted only when it changes.

#### Scenario: Consecutive claims with the same pending set

- **GIVEN** an APPROVED task with pending `req-1`
- **WHEN** two consecutive completion claims are processed
- **THEN** the first claim injects the gate hold and validation
- **AND** the second claim injects neither, avoiding a blocking loop
