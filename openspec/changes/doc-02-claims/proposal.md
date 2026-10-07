# Change: Claims Documentation

## Why

Los claims actuales mezclan afirmaciones con evidencia sin un modelo de estado
(`Implemented`/`Tested`/`Measured`/`Observed`/`Design target`) y sin trazar cada
afirmación a código, tests y artifacts.

## What Changes

- Actualizar `docs/claims/README.md` con índice y modelo de evidencia.
- Crear `docs/claims/deterministic-control.md`.
- Actualizar `docs/claims/context-management.md`, `task-state.md`,
  `skill-selection.md`, `task-isolation.md`, `verification.md`,
  `less-guessing.md`.

## Non-goals

- No promover estados de evidencia.
- No inventar rutas de implementación o test.

## Expected Result

Cada claim identifica implementación, tests, evidencia de benchmark (si aplica),
estado actual y gaps de validación.

## Validation

- [ ] 7 claims documentados con referencias trazables.
- [ ] Todo claim cuantitativo referencia un artifact de benchmark.

## Program

- Change paraguas: `documentation-improvement`
- Prioridad: P1
