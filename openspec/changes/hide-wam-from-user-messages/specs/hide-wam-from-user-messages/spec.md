# Hide WAM Messages from User Chat Window

## ADDED Requirements

### Requirement: Hide WAM operational messages from user chat

WAM operational notices, prompts, and status updates MUST NOT be injected into visible user-facing chat parts during regular conversation turns.

#### Scenario: No visible [wam] text in chat
- **WHEN** WAM processes a chat message and emits operational updates
- **THEN** synthetic text parts are hidden from the user chat window and logged internally

### Requirement: Retain final task summary

Final task completion summaries and explicitly requested audit reports MUST be allowed to display WAM summary details.

#### Scenario: Display summary on completion
- **WHEN** a task reaches completion
- **THEN** the task summary displays final metrics without polluting intermediate user turns
