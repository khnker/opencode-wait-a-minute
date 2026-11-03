# Tasks — agent step task identity

## 1. Implementation

- [x] 1.1 Pass `taskId` from `maybeTaskLoop` into the configured agent step.
- [x] 1.2 Accept `taskId` in `runConfiguredTaskAgentStep` and `runTaskAgentStep`.
- [x] 1.3 Use it when the persisted snapshot has no identity.

## 2. Tests

- [x] 2.1 Run a step with a snapshot lacking `id` and assert every invocation
      carries the supplied `taskId`.
- [x] 2.2 Verify a real session on an isolated server creates a WAM worker.

## 3. Validation

- [x] 3.1 `node --test --test-force-exit tests/unit/task-agent-loop.test.mjs tests/unit/session-task-binding.test.mjs tests/unit/plugin-load.test.mjs`
- [x] 3.2 `openspec validate --changes --strict`
- [x] 3.3 `npm run build` and load `dist/index.js`
