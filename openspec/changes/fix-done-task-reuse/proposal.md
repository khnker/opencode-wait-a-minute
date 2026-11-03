# Fix DONE task reuse for new instructions

## Why

`effectiveTaskId` resolves the cached session task or the session-owned active
task before checking its phase. When that task is already `DONE`, a brand-new
non-continuation prompt reuses it, so no new task is created and the task
loop / agent pass never runs for the new instruction.

## What Changes

- Skip a `DONE` cached/active task when the prompt is a new instruction.
- Derive a fresh task id (slug or session namespace, with a collision suffix)
  so a new task directory is created and the normal task loop can run.
- Preserve continuation and auto-loop binding: explicit continuation prompts
  and synthetic `WAM ...` prompts still reuse the existing `DONE` task.
- Add regression tests for the DONE-reuse and continuation paths.

## Impact

- Affected specs: `task-session-binding`
- Affected code: `index.js`, `src/integration/message-handler.js`
- No change to task phase transitions, approvals or completion flow.
