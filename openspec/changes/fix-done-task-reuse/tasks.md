# Tasks — DONE task reuse

## 1. Implementation

- [x] 1.1 Inject `isTaskDone` into `effectiveTaskId`.
- [x] 1.2 Skip cached/active `DONE` ids for non-continuation prompts.
- [x] 1.3 Derive a fresh id with a collision suffix when the fallback matches
      the skipped `DONE` task.
- [x] 1.4 Pass `getTaskState(...).phase === "DONE"` from `chat.message`.
- [x] 1.5 Check the derived fallback id itself for a cold-cache `DONE` task.

## 2. Tests

- [x] 2.1 New instruction does not reuse a cached `DONE` task and the agent
      pass is eligible.
- [x] 2.2 New instruction does not reuse an active-only `DONE` task.
- [x] 2.3 Continuation and empty prompts still reuse the `DONE` task.
- [x] 2.4 Session-namespace fallback does not reuse the `DONE` task.
- [x] 2.5 Cold-cache session-namespace fallback does not reuse the `DONE` task.

## 3. Validation

- [x] 3.1 `node --test --test-force-exit tests/unit/session-task-binding.test.mjs`
- [x] 3.2 `node --test --test-force-exit tests/unit/task-id-slug.test.mjs`
- [x] 3.3 `npm run build` and load `dist/index.js`
- [x] 3.4 `openspec validate --changes --strict`
