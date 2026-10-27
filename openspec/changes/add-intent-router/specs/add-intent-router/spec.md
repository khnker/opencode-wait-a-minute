# Spec: Intent router

## ADDED Requirements

### Requirement: State-aware intent lanes

The system MUST classify each user message into exactly one lane: CONVERSATION, CONTINUATION, CORRECTION or TASK_NEW.

#### Scenario: Meta message
- **GIVEN** the prompt "ok" or "no te detengas"
- **WHEN** the intent is classified
- **THEN** the lane is CONVERSATION
- **AND** no contract is created

#### Scenario: Continuation
- **GIVEN** an APPROVED task and the prompt "sigue con el paso 2"
- **WHEN** the intent is classified
- **THEN** the lane is CONTINUATION

#### Scenario: Correction
- **GIVEN** a PROPOSED/APPROVED task and the prompt "no, era con soft delete"
- **WHEN** the intent is classified
- **THEN** the lane is CORRECTION
- **AND** the existing contract is updated, not replaced

#### Scenario: New task
- **GIVEN** the prompt "implementa un endpoint OAuth2 con tests"
- **WHEN** the intent is classified
- **THEN** the lane is TASK_NEW
- **AND** a contract is synthesized
