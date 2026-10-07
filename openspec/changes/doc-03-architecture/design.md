# Design: Architecture Documentation

## Approach

La arquitectura documenta CÓMO la implementación realiza el modelo conceptual.
El source of truth es `src/`; los documentos se derivan del código, no al revés.

## Scope

overview, task-lifecycle, context-selection, state-persistence, invariants.

## Source of truth

- Máquina de estados: `src/execution/execution-state.js` (`ALLOWED_TRANSITIONS`).
- Context selection: `src/context/assembly.js`, `src/context/context.js`.
- Persistencia: `src/state/state-store.js`, `src/state/task-store.js`.

## Validation Strategy

- Comparar el diagrama Mermaid con `ALLOWED_TRANSITIONS`.
- Verificar rutas referenciadas.
- docs-check para links.

## Risks

- Preservar terminología obsoleta por inercia.
- Describir persistencia en restart sin demostrarla.
