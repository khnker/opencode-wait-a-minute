# Spec: Natural conversation and zero WAM pollution

## ADDED Requirements

### Requirement: Zero visible WAM prefixes in chat

The system MUST NOT emit `[wam]` text parts or operational phase notices into the user-facing chat window during regular conversation.

#### Scenario: Regular conversation turn

- **GIVEN** a regular conversation message
- **WHEN** WAM processes it
- **THEN** no `[wam]` part is emitted into `output.parts`

### Requirement: Internal logging and final summary only

The system MUST keep task, contract and gate diagnostics internal or in the final task completion summary.

#### Scenario: Task progress

- **GIVEN** a task in progress
- **WHEN** WAM records status or diagnostics
- **THEN** they are logged internally and not emitted as intermediate chat parts
