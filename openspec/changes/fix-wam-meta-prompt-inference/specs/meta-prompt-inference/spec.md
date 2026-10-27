# Spec: Fix meta-prompt inference

## ADDED Requirements

### Requirement: Meta prompts are trivial

The system MUST classify a prompt as trivial when every clause is a
control/meta phrase, and MUST NOT create contract requirements from it.

#### Scenario: Control phrase is not a requirement

- **GIVEN** the prompt "responde solo: ok"
- **WHEN** the request is classified and the contract is synthesized
- **THEN** classification is `trivial`
- **AND** the contract has zero requirements

#### Scenario: Broad maintenance plus control phrases

- **GIVEN** the prompt "arregla todo, no te detenga, ahora eres responsable de wam de que esta todo bien"
- **WHEN** the contract is synthesized
- **THEN** no requirement contains "Todo", "No te detenga" or "eres responsable"
- **AND** the completion gate does not block the response

### Requirement: Gate does not apply to trivial analyses

The completion gate MUST be skipped for `trivial` or `FAST` analyses so a
conversational message cannot trigger VALIDACIÓN or a phase loop.

#### Scenario: Trivial message does not emit a gate

- **GIVEN** a trivial request
- **WHEN** `chat.message` processes it
- **THEN** no COMPLETION GATE / VALIDACIÓN part is emitted
- **AND** the task phase is not changed to VERIFYING or IMPLEMENTING
