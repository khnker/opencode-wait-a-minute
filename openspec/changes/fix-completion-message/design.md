# Design: Fix the final completion message

## Gate evaluation

`isCompletionIntent(promptText)` is computed before `isTrivialAnalysis`.
`isTrivialAnalysis` is false for completion claims, so
`evaluateCompletionGate` runs even when the intent router classifies
"listo, terminado" as CONVERSATION.

## Completion notice

On `gate.allDone` and `phase === "DONE"`, emit `notice.task_complete` once:

```
✅ Tarea completada — contrato verificado
Objetivo: ...
Requisitos verificados: N
Evidencia: ...
Artefactos: .wam/tasks/<id>/summary.md, recent-changes.md
```

`state.completionNotified = true` is persisted so subsequent DONE claims do not
repeat the message.

## Prompt catalog

`prompts/notices/task-complete.md` is registered in `prompts/index.json` with
`message-handler.js` as consumer and the completion test as `testRefs`, so
`prompts:check` and catalog integrity stay green.

## Alternatives rejected

- Emitting the message from `applyPhaseTransition` (pure function, no output
  access).
- Reusing `notice.completion_gate` (that is a rejection message, not a success
  summary).
