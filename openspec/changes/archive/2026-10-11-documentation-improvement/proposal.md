# Change: Documentation Improvement (umbrella)

## Why

La documentación de WAM no refleja con precisión la arquitectura, los claims,
la estrategia de validación y la evidencia de benchmark que existen en el
repositorio. Hay afirmaciones sin trazabilidad a código/tests/artefactos,
terminología obsoleta ("pre-flight", "cognitive gate" como concepto primario) y
números de benchmark que no distinguen clases de evidencia (determinista vs
empírica vs externa).

Este cambio es el **paraguas**: define el modelo documental, la disciplina de
evidencia y la partición en changes pequeños ejecutables de forma independiente,
para no perder el control durante la reescritura.

## What Changes

- Crea `docs/AGENT_INSTRUCTIONS.md`: manual de ejecución para el agente de
  documentación (análisis obligatorio del repo antes de escribir).
- Reescribe `README.md` con el modelo central ("WAM keeps more state than it
  sends"), diagramas Mermaid y sin "Cognitive Gate"/"pre-flight" como concepto
  primario.
- Reorganiza la documentación en cinco capas:
  - `docs/concepts/` — QUÉ es el modelo conceptual.
  - `docs/architecture/` — CÓMO lo realiza la implementación.
  - `docs/claims/` — QUÉ afirma WAM y DÓNDE está la evidencia.
  - `docs/validation/` — CÓMO se valida la premisa (perturbación causal).
  - `docs/benchmarks/` — CÓMO se producen las mediciones cuantitativas.
- Define la disciplina de evidencia con estados: `Implemented`, `Tested`,
  `Measured`, `Observed`, `Design target`. Nunca se promueve un estado.
- Separa explícitamente `context reduction` de `token savings` y de
  `provider cost`.
- Genera los changes hijos (uno por capa documental) para ejecución controlada.

## Non-goals

- No cambiar el comportamiento de producción del plugin.
- No fabricar resultados de benchmark para satisfacer un umbral del README.
- No promover un `Design target` a `Measured` sin artefacto reproducible.
- No convertir reducción de contexto en ahorro de tokens sin accounting.

## Expected Result

Documentación verificable y trazable, organizada por capas, con un change
pequeño por capa y validación de links/terminología/claims.

## Validation

- [ ] `node scripts/docs-check.mjs` pasa (todo link Markdown relativo resuelve).
- [ ] `openspec validate documentation-improvement --strict` pasa.
- [ ] Cada claim con estado fuerte tiene referencia a código + test + artifact.
- [ ] Búsqueda de terminología obsoleta (`pre-flight`, `cognitive gate`) sin
      usos como concepto primario.
- [ ] Cada número cuantitativo del README traza a `benchmarks/reports/rc1/`.

## Program

- Change paraguas: `documentation-improvement`.
- Changes hijos generados:
  - `doc-01-foundation`
  - `doc-02-claims`
  - `doc-03-architecture`
  - `doc-04-validation`
  - `doc-05-benchmarks`
- Prioridad: P1
