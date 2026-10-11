# Change: Architecture Documentation

## Why

Los documentos de arquitectura describen un flujo "pre-flight" genérico y no el
mapa real de componentes. `task-lifecycle.md` no coincide con la máquina de
estados de `src/execution/execution-state.js`, `context-selection.md` es genérico
y falta `state-persistence.md`. `invariants.md` tiene contenido duplicado.

## What Changes

- Actualizar `docs/architecture/overview.md` (component map real).
- Sincronizar `docs/architecture/task-lifecycle.md` con el source of truth.
- Actualizar `docs/architecture/context-selection.md` con el mecanismo real.
- Crear `docs/architecture/state-persistence.md`.
- Completar/deduplicar `docs/architecture/invariants.md`.

## Non-goals

- No inventar componentes inexistentes en el código.

## Expected Result

Arquitectura documentada que coincide con la implementación y con la máquina de
estados real.

## Validation

- [ ] Diagrama de estados coincide con `ALLOWED_TRANSITIONS`.
- [ ] `state-persistence.md` no afirma persistencia no demostrada.
- [ ] `invariants.md` sin secciones duplicadas.

## Program

- Change paraguas: `documentation-improvement`
- Prioridad: P1
