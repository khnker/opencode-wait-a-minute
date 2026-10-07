# Design: Documentation Foundation

## Approach

Primero crear el manual (`docs/AGENT_INSTRUCTIONS.md`) que obliga a inspeccionar
el repositorio antes de escribir. Luego reescribir el README alrededor del modelo
central, y derivar los conceptos desde el comportamiento real del código.

## Concept model

```
Persistent state → Current task state → Context selection → Model context → Decision → Action → Evidence → Updated state
```

## Scope

README, AGENT_INSTRUCTIONS y los cinco conceptos base.

## Validation Strategy

- docs-check para links.
- Revisión de terminología obsoleta.
- Cada concepto enlaza a su capa de arquitectura/claims.

## Risks

- Duplicar explicación con architecture/: mitigar enlazando.
- Convertir el README en informe de auditoría: mantenerlo en ~5 min.
