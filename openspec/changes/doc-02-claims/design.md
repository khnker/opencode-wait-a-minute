# Design: Claims Documentation

## Approach

Cada claim se documenta como una unidad trazable: afirmación → mecanismo →
implementación → tests → evidencia. El estado de evidencia se asigna hacia abajo
(nunca se promueve).

## Evidence model

| Estado | Significado |
| --- | --- |
| Implemented | El mecanismo existe en código |
| Tested | Cobertura automatizada del comportamiento |
| Measured | Evidencia cuantitativa reproducible |
| Observed | Observado en una ejecución específica |
| Design target | Intención sin evidencia suficiente |

## Scope

Los siete claims de `docs/claims/`.

## Validation Strategy

Trazar cada claim a `src/` y `tests/`; verificar rutas existen.

## Risks

- Inventar rutas: solo referencias verificadas en el repo.
- Generalizar: mantener cada claim en el alcance de las políticas implementadas.
