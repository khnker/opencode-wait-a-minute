# Relevant Skill Loading

## Claim

WAM loads only skills relevant to the current task, reducing overhead and avoiding conflicts.

## What this means

Without WAM, agents might:
- Load all available skills
- Experience skill conflicts
- Waste initialization time

WAM selects skills based on task type and evidence from the pre-flight.

## How WAM does it

WAM's skill selection:
- Analyzes the task type (exploration, implementation, etc.)
- Matches against skill metadata (tags, capabilities)
- Loads only the top-scoring skills
- Caches skill selections for similar tasks

## Evidence

- Implementation: `src/skills/engine.js`
- Unit tests: `tests/unit/skill-routing.test.mjs`

## Limitations

WAM's skill selection relies on accurate skill metadata. Poorly tagged skills may not be selected when needed.

## Related documentation

- [Less Guessing](less-guessing.md)
- [Task State](task-state.md)
