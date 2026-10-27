# Design: Fix meta-prompt inference

## Decisions

### Meta-only detection
`classifyRequest` gains an `isMetaOnlyPrompt` check:
- split the prompt on clause separators (`; , . y and`)
- if every clause is a control/meta phrase, return `trivial`.
- Meta phrases: `ok/vale/perfecto/gracias`, `sigue/continúa/adelante`,
  `no te detengas/detenga/pares`, `responde solo/solamente`,
  `eres/sé responsable`, `(que) esté/todo bien|ok|listo`, `arregla todo`,
  `fix everything`, and bare `todo`.

### Contract synthesis
- `synthesizeContract` returns zero requirements when mode is `FAST`.
- Meta/control clauses are added to `NON_ACTIONABLE_PATTERNS` so they cannot
  become requirements even in non-FAST modes.
- When no actionable clause survives, return zero requirements with
  `trivial: true`; never fall back to "Tarea completada según intención" /
  "Resultados verificables" (unverifiable placeholders).

### Gate scope
`handleMessage` computes the completion gate only for non-trivial analyses.
For `classification === "trivial"` or `strategy === "FAST"` it uses
`{ blocked: false, allDone: false }`, so no VALIDACIÓN part and no phase drift.

## Trade-off
A broad "arregla todo" is treated as an open-ended instruction rather than a
falsifiable contract. That is intentional: WAM cannot verify "todo", and
fabricating requirements causes the loop we observed.
