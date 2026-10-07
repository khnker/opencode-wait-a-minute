# Change: Documentation Foundation (README + Concepts)

## Why

El README y los documentos conceptuales actuales describen una arquitectura
intencional, no la implementada, y usan "pre-flight"/"cognitive gate" como
conceptos primarios. Falta el modelo central "WAM keeps more state than it
sends" y el manual de ejecución para el agente de documentación.

## What Changes

- Crear `docs/AGENT_INSTRUCTIONS.md`.
- Reescribir `README.md`.
- Crear `docs/concepts/state-vs-context.md`,
  `docs/concepts/task-context-lifecycle.md`,
  `docs/concepts/context-separation.md`,
  `docs/concepts/context-enrichment.md`,
  `docs/concepts/evidence-driven-state.md`.

## Non-goals

- No modificar el comportamiento de producción.

## Expected Result

README legible en ~5 minutos y una base conceptual que separa estado persistente
de contexto transitorio.

## Validation

- [ ] `docs/AGENT_INSTRUCTIONS.md` existe con secciones de análisis obligatorio.
- [ ] README sin "Cognitive Gate" como concepto primario.
- [ ] 5 documentos conceptuales existen y enlazan a architecture/claims.

## Program

- Change paraguas: `documentation-improvement`
- Prioridad: P1
