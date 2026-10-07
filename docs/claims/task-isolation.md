# Task Isolation

## Claim

WAM isolates task-specific state so unrelated task state does not become active
context.

## Example

```text
Task A:
Fix payment timeout

Task B:
Update README
```

Task B should derive its context from Task B state and relevant repository
information rather than inheriting Task A's payment-specific context.

## Required evidence

- task identity — task ids namespace state under `.wam/tasks/<taskId>/`
  (`src/state/task-store.js`);
- task storage namespace — per-task directories;
- active-task selection — `retrieveActiveContext(items, purpose)`
  (`src/context/active-context-boundary.js`);
- context boundary — session identity scoped to `(root, OpenCode sessionID)`
  (`getSessionId`, `src/context/context.js`);
- task completion behavior — a completed task is terminal
  (`src/execution/execution-state.js`);
- task cancellation behavior — handled by the lifecycle manager
  (`src/state/lifecycle-manager.js`).

## Tests

- `tests/isolation/run.mjs` — Task A reaches `completed`, then a new prompt
  starts Task B fresh (`status: "active"`, no `completedAt` inherited);
- `tests/runtime-state-isolation.test.mjs` — `.wam` is runtime-only: ignored by
  git, never tracked, never published;
- `tests/unit/active-context-boundary.test.mjs` — active-context filtering.

**Status: Implemented, Tested.**

## See also

- [Context Separation](../concepts/context-separation.md)
- [Task State](task-state.md)
