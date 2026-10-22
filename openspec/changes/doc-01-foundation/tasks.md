# Tasks: Documentation Foundation

## Implementation
- [x] Crear `docs/AGENT_INSTRUCTIONS.md`.
- [x] Reescribir `README.md` con el modelo central y diagramas Mermaid.
- [x] Crear `docs/concepts/state-vs-context.md`.
- [x] Crear `docs/concepts/task-context-lifecycle.md`.
- [x] Crear `docs/concepts/context-separation.md`.
- [x] Crear `docs/concepts/context-enrichment.md`.
- [x] Crear `docs/concepts/evidence-driven-state.md`.

## Validation
- [x] `node scripts/docs-check.mjs` pasa.
- [x] `grep -rn "pre-flight\|cognitive gate" README.md docs/concepts` solo en
      contexto histórico, nunca como concepto primario.
- [x] `openspec validate doc-01-foundation --strict` pasa.
