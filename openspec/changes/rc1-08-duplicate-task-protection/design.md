# Design: Duplicate Task Protection

## Approach
Semantically identical task intents previously created multiple persisted tasks.

## Scope
- Golden tests for intents: terminé/termine, done, finished, continue, keep going, and different representations of the same task.
- Same semantic task -> same persisted task; never task-001 -> task-002 -> task-003.

## Validation Strategy
- Each intent maps to the same task.
- No task-NNN proliferation.
- Different tasks are still distinguished.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
