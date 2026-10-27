# Change: automatic-completion-loop

## Why

Today the completion gate only rejects a DONE claim when the *next* user message
arrives: it injects "Acción solicitada por el usuario: Listo, continúa" and waits
for a human to press enter. If the agent declares DONE while requirements are
still pending, the session goes idle and nothing happens until the user types
again. The user asked for that continuation to be automatic: after the DONE
review finds missing work (or new evidence of it), WAM must re-drive the agent
until the review finds nothing left to fix.

## What Changes

1. Track the last assistant message per session.
2. On `session.idle`, if the active task's completion gate is blocked **and** the
   assistant's last message claims completion, send the gate validation back into
   the same session automatically via `client.session.prompt`.
3. Bound the loop per pending signature (progress resets the counter) and with a
   total cap, so a stuck gate cannot spin forever.
4. New `autoLoop` runtime flag (default `true`, env `WAM_AUTO_LOOP=0` /
   `WAM_DISABLE_AUTO_LOOP=1`).

## Non-goals

- Auto-approving contracts or requirements.
- Running tools/tests on the agent's behalf.
- Continuing sessions that did not claim completion (e.g. waiting for a user
  decision).
- Subagent sessions (child sessions are skipped).
