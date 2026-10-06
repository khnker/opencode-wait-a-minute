# Task Isolation

## Claim

WAM isolates task state to prevent cross-task contamination.

## What this means

Without WAM, agents might:
- Carry over assumptions from previous tasks
- Use incorrect context for a new task
- Mix evidence from unrelated work

WAM resets task state between distinct user requests.

## How WAM does it

WAM:
- Creates a new task instance for each top-level user request
- Clears context and state when a task is done or cancelled
- Uses namespaced storage for task-specific data

## Evidence

- Implementation: `src/task-store.js`
- Unit tests: `tests/unit/task-store/`
- E2E scenarios: `tests/e2e/task-isolation/`

## Limitations

WAM assumes task boundaries are clear from user prompts. Ambiguous requests may require manual intervention.

## Related documentation

- [Less Guessing](less-guessing.md)
- [Task State](task-state.md)
