# Fix agent step task identity

## Why

`maybeTaskLoop` loads the persisted task with `getTaskState`, which returns the
raw `task.json` payload. That payload has no `id` field, so
`buildTaskAgentInput` threw `task.id or task.taskId is required` on every real
session. The error was caught and logged, the loop continued without an agent
run, and no worker sessions were created.

## What Changes

- Pass the active `taskId` into `runConfiguredTaskAgentStep` and
  `runTaskAgentStep`.
- Use that `taskId` as the identity when the persisted snapshot has no `id`,
  `taskId` or `task_id`.
- Cover a persisted snapshot without identity in the task-agent tests.

## Impact

- Affected specs: `agent-task-execution`
- Affected code: `index.js`, `src/execution/task-agent-run.js`
- No change to the persisted task format or the public agent result contract.
