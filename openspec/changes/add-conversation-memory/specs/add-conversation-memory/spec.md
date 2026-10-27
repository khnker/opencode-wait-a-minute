# Spec: Conversation memory

## ADDED Requirements

### Requirement: Conversation entities are recalled

The system MUST keep a bounded rolling summary and entity table and inject relevant entities into later turns.

#### Scenario: File entity recall
- **GIVEN** a file path mentioned three turns ago
- **WHEN** the user asks "sigue con ese archivo"
- **THEN** the file path is recalled without asking again

#### Scenario: Compaction
- **GIVEN** a session above the turn threshold
- **WHEN** memory is compacted
- **THEN** the summary and entity table stay under their caps
