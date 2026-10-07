# Tasks: Documentation Improvement (umbrella)

## Fase 0 — Preparación
- [x] Crear `docs/AGENT_INSTRUCTIONS.md` con el mandato de análisis previo al repo.
- [x] Congelar el modelo central y la disciplina de evidencia (ver design.md).
- [x] Identificar terminología obsoleta a migrar (`pre-flight`, `cognitive gate`).

## Fase 1 — Change hijo doc-01-foundation
- [x] Reescribir `README.md` (~5 min de lectura, diagramas Mermaid, sin
      "Cognitive Gate" como concepto primario).
- [x] Crear `docs/concepts/state-vs-context.md`.
- [x] Crear `docs/concepts/task-context-lifecycle.md`.
- [x] Crear `docs/concepts/context-separation.md`.
- [x] Crear `docs/concepts/context-enrichment.md`.
- [x] Crear `docs/concepts/evidence-driven-state.md`.

## Fase 2 — Change hijo doc-02-claims
- [x] Actualizar `docs/claims/README.md` (índice + modelo de evidencia).
- [x] Crear `docs/claims/deterministic-control.md`.
- [x] Actualizar `docs/claims/context-management.md`.
- [x] Actualizar `docs/claims/task-state.md`.
- [x] Actualizar `docs/claims/skill-selection.md`.
- [x] Actualizar `docs/claims/task-isolation.md`.
- [x] Actualizar `docs/claims/verification.md`.
- [x] Actualizar `docs/claims/less-guessing.md`.

## Fase 3 — Change hijo doc-03-architecture
- [x] Actualizar `docs/architecture/overview.md` (component map real).
- [x] Actualizar `docs/architecture/task-lifecycle.md` (sincronizar con
      `src/execution/execution-state.js`).
- [x] Actualizar `docs/architecture/context-selection.md` (mecanismo real).
- [x] Crear `docs/architecture/state-persistence.md`.
- [x] Completar `docs/architecture/invariants.md` (deduplicado).

## Fase 4 — Change hijo doc-04-validation
- [x] Crear `docs/validation/premise.md`.
- [x] Crear `docs/validation/causal-decision-matrix.md`.

## Fase 5 — Change hijo doc-05-benchmarks
- [x] Crear `docs/benchmarks/README.md`.
- [x] Crear `docs/benchmarks/methodology.md`.
- [x] Actualizar `docs/benchmarks/results.md` desde artifacts reales.
- [x] Actualizar `docs/benchmarks/limitations.md`.
- [x] Actualizar `docs/benchmarks/RC1.md`.

## Fase 6 — Cierre y verificación
- [x] `node scripts/docs-check.mjs` pasa.
- [x] `openspec validate --all --strict` pasa.
- [x] Grep de terminología obsoleta sin usos primarios.
- [x] Trazar cada claim fuerte a código + test + artifact.
- [x] Completar el reporte final del agente (claims verificados, medidos,
      discrepancias, cambios de código/benchmark requeridos).
