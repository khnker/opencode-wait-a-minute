# Proposal: Continue on new evidence (remove `/wam resume`)

## Why

When a task is paused or stopped, WAM asks the user to type `/wam resume <id>`
to keep going. That manual step is ceremony: if a real pending task exists and
the user brings new evidence that requires a correction, the loop can continue
on its own without inventing intent.

## What Changes

- Remove the `/wam resume` slash command from the command surface.
- Auto-continue a **grounded** pending task when the user signals continuation
  or supplies corrective evidence.
- Keep asking when there is no pending task: never fabricate a task from a vague
  "sigamos".
- Stop guidance references the evidence/correction to send, not a command.
- Remove the now-dead `notice.pending_task` prompt, fixture and catalog entry.

## Out of scope

- `STOP_STAGNATION`, budget caps, `BLOCK`, contract approval and the
  clarification/assumption gates keep their precedence.
- Internal helpers named `resumeSession` / `resumeWorkflow` / task-lifecycle
  `resume` are not user commands and stay.

## Research

- Existing continuation detection: `openspec/specs/agent-flow-autonomy/spec.md`
  ("Continuation detection").
- Loop decisions and stop guidance: `src/execution/task-loop.js`.
- Pending-task gate: `src/integration/message-handler.js` (`RESUME_RE` branch).
- Prompt catalog integrity: `scripts/prompts-check.mjs`.
