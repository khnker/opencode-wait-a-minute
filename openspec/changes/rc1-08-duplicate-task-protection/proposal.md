# Change: Duplicate Task Protection

## Why
Semantically identical task intents previously created multiple persisted tasks.

## What Changes
- Golden tests for intents: terminé/termine, done, finished, continue, keep going, and different representations of the same task.
- Same semantic task -> same persisted task; never task-001 -> task-002 -> task-003.

## Non-goals
- Equating raw string equality with task identity.

## Expected Result
Semantically identical tasks map to a single persisted task.

## Validation
- [ ] Each intent maps to the same task.
- [ ] No task-NNN proliferation.
- [ ] Different tasks are still distinguished.

## Program
- RC1 item: RC1-08 (C)
- Priority: P0
