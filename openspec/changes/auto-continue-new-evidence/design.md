# Design: Continue on new evidence (remove `/wam resume`)

## Goal

A pending, non-DONE task continues automatically when the user shows
continuation intent or brings corrective evidence, while an ungrounded request
still asks instead of guessing.

## Alternatives

1. Keep `/wam resume` and only change the copy. Rejected: the command remains a
   manual gate and the user asked to remove it.
2. Auto-continue on any message whenever any task exists. Rejected: a vague
   "sigamos" with no resolvable task would invent intent — exactly the
   hallucination the requirement forbids.
3. Grounded auto-continue (chosen): when `RESUME_RE` matches, resolve the active
   pointer; if it maps to a real non-DONE task, fall through to the normal
   continuation path; otherwise emit `notice.no_active_task`.

## Decision

- `src/integration/message-handler.js`: the `RESUME_RE` branch only emits
  `notice.no_active_task` when no non-DONE task is resolvable; it no longer emits
  the pending-task notice nor early-returns when a task exists. The existing
  `effectiveTaskId` session binding then adopts the pending task and the loop
  continues.
- `index.js`: delete the `/wam resume` dispatch block. The command falls through
  to the usage line, which never listed `resume`.
- `src/execution/task-loop.js`: stop guidance names the evidence/correction to
  send instead of a resume command.
- Remove `notice.pending_task` (prompt file, fixture, catalog entry). It existed
  only to offer `/wam resume`.
- Keep the internal `resumeTask` plugin helper used by tests; it is not a user
  command.

## Anti-hallucination guard

Continuation is gated on a real pending task resolved from the session-scoped
active pointer. No task means no continuation: WAM emits `notice.no_active_task`
and stops. Existing `STOP_STAGNATION`, budget, `BLOCK`, contract-approval and
clarification/assumption gates are untouched and keep precedence.

## Verification

- Unit: message-handler continuation, plugin-load auto-continue, task-loop stop
  text, prompt catalog integrity.
- Fresh-session web E2E against the final code (`npm run verify:web`).
