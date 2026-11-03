# Design — agent step task identity

## Research

- OpenCode SDK session envelope: https://opencode.ai/docs/sdk/
- Existing WAM task loading: `getTaskState` returns `task.json` verbatim and the
  task id is the directory name, not a field in the payload.
- Existing agent input builder: `buildTaskAgentInput` already accepts `id`,
  `taskId` or `task_id`.

## Alternatives

1. **Pass the active `taskId` into the agent step (chosen).** Minimal, keeps the
   persisted state untouched and makes the caller's identity explicit.
2. Add `id` inside `getTaskState`. Rejected: it changes a shared read path and
   would write a synthetic field into state the next time it is persisted.
3. Derive the id from the snapshot directory in `buildTaskAgentInput`. Rejected:
   the builder only receives the payload, not the root or directory, and should
   stay pure.

## Decisions

- `runConfiguredTaskAgentStep` and `runTaskAgentStep` accept an optional
  `taskId`.
- When the snapshot lacks identity, the step builds `{ ...task, id: taskId }`
  before validating the input.
- An explicit identity on the snapshot still wins.
