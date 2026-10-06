# Context Management

## Claim

WAM reduces unnecessary context by loading only relevant information for the current task.

## What this means

Without WAM, agents might:
- Load entire repository context
- Include irrelevant files
- Waste tokens on unrelated code

WAM selects context based on task type, current turn, and relevant skills.

## How WAM does it

WAM's context selection considers:
- Task state (what we know so far)
- Current user prompt
- Available skills
- Repository structure

It loads only the minimal context needed for the next step.

## Evidence

- Implementation: `src/context/`
- Unit tests: `tests/unit/context/`
- E2E scenarios: `tests/e2e/context-selection/`

## Limitations

WAM's context selection is heuristic-based. Edge cases may load too much or too little context.

## Related documentation

- [Less Guessing](less-guessing.md)
- [Task State](task-state.md)
