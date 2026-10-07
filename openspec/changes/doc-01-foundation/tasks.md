# Tasks: Documentation Foundation

## Implementation
- [ ] Crear `docs/AGENT_INSTRUCTIONS.md`.
- [ ] Reescribir `README.md` con el modelo central y diagramas Mermaid.
- [ ] Crear `docs/concepts/state-vs-context.md`.
- [ ] Crear `docs/concepts/task-context-lifecycle.md`.
- [ ] Crear `docs/concepts/context-separation.md`.
- [ ] Crear `docs/concepts/context-enrichment.md`.
- [ ] Crear `docs/concepts/evidence-driven-state.md`.

## Validation
- [ ] `node scripts/docs-check.mjs` pasa.
- [ ] `grep -rn "pre-flight\|cognitive gate" README.md docs/concepts` solo en
      contexto histórico, nunca como concepto primario.
- [ ] `openspec validate doc-01-foundation --strict` pasa.
