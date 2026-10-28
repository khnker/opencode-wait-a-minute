# Proposal: Fix the final completion message

## Why

The final completion message (`Tarea completa — contrato verificado`) was coded
but never emitted:

- completion claims like "listo, terminado" were classified as CONVERSATION,
  so the completion gate was skipped;
- even when the gate returned `allDone`, the handler had no visible completion
  notice.

## What changes

- Completion intent always overrides the conversation/trivial short-circuit, so
  the gate runs.
- Add `prompts/notices/task-complete.md` and its catalog entry.
- Emit the final message once when the gate allows DONE, with objective,
  verified requirement count, evidence and artifacts.
- Persist `completionNotified` so the message is not repeated.

## Impact

- Users see a real completion summary when the contract is verified.
- The DONE phase is reachable from natural completion claims.
