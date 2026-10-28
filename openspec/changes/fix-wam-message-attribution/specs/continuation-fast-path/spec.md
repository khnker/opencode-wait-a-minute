# Spec: Continuation instructions are not completion claims

## ADDED Requirements

### Requirement: Continuation prompts create no contract

The system MUST treat an explicit continuation instruction — optionally
preceded by an acknowledgement ("listo", "ok", "dale", "vale") — as a meta
prompt. Such a prompt MUST NOT be classified as a completion claim and MUST NOT
synthesize contract requirements.

#### Scenario: Acknowledgement plus continuation

- **GIVEN** an APPROVED task with pending requirements
- **WHEN** the user writes "listo sigue" or "listo, continúa"
- **THEN** `isCompletionIntent` returns false
- **AND** no completion-gate notice or validation is injected
- **AND** `synthesizeContract("listo sigue", "NORMAL")` returns no requirements
  and `trivial: true`

#### Scenario: Bare continuation

- **WHEN** the user writes "sigue" or "ok seguí"
- **THEN** the prompt is classified as a continuation, not as a claim
- **AND** it does not become a requirement in a new contract
