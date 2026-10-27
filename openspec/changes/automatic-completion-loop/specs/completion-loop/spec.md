# Automatic Completion Loop

## ADDED Requirements

### Requirement: Automatic continuation after a rejected DONE
WAM MUST send the gate validation back into the same session automatically,
without waiting for a new user message, when the assistant claims completion, the
session goes idle, and the completion gate still has pending requirements.

#### Scenario: DONE rejected while requirements are pending
- **WHEN** the last assistant message claims completion
- **AND** the active task's completion gate is blocked
- **THEN** WAM sends the completion validation into the session
- **AND** WAM records the auto-loop attempt in the task state

#### Scenario: Session idle without a completion claim
- **WHEN** the session goes idle and the last assistant message does not claim completion
- **THEN** WAM does not send a prompt

### Requirement: Bounded, progress-aware loop

The automatic loop MUST stop when the pending set repeats without progress, when
a total attempt budget is exhausted, or when the auto-loop flag is disabled.

#### Scenario: Same pending set repeats
- **WHEN** the same pending signature reaches the per-signature cap
- **THEN** WAM stops re-driving and marks the loop exhausted

#### Scenario: Progress resets the counter
- **WHEN** the pending signature changes between attempts
- **THEN** the per-signature counter restarts

#### Scenario: Disabled by configuration
- **WHEN** `autoLoop` is `false` in `.wam/config.json` or `WAM_AUTO_LOOP=0`
- **THEN** WAM never sends automatic continuation prompts
