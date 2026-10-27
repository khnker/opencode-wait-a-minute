# Spec: fix-wam-conversational-friction-and-tests

## ADDED Requirements

### Requirement: Flexible Conversational Intent Recognition
The system MUST recognize implicit execution intent and handle user frustration gracefully without blocking execution on rigid contract prompts.

#### Scenario: User expresses frustration or directs execution
- Given an active WAM session in PROPOSED state
- When the user issues an urgent or direct instruction ("ejecuta el cambio", "no hiciste nada")
- Then the system adapts pragmatically, advancing state without unnecessary friction loops.
