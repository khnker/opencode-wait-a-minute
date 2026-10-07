# Design: Documentation Improvement

## Approach

La documentación se trata como un artefacto verificable, no como texto estático.
El agente de documentación primero **inspecciona el repositorio** y luego escribe:

```
código real  ──►  contrato documental  ──►  claims trazables  ──►  evidencia
     ▲                                                                    │
     └────────────────────── corrección / discrepancia ◄──────────────────┘
```

## Modelo central

WAM agrega control determinista, gestión de estado de tarea, enriquecimiento de
contexto y optimización de tokens a agentes OpenCode, correlacionando tareas,
skills, contexto, evidencia y estado verificado para decidir qué debe ocurrir.

La distinción arquitectónica central:

> El estado de tarea persistente se mantiene separado del contexto transitorio
> que se envía al modelo.

Frase canónica:

> **WAM keeps more state than it sends.**

El contexto enviado al modelo se reconstruye desde el estado requerido para la
decisión actual, no se acumula desde el historial de conversación.

## Disciplina de evidencia

Cada afirmación fuerte tiene exactamente uno de estos estados:

| Estado | Significado |
| --- | --- |
| Implemented | El mecanismo existe en código de producción |
| Tested | El comportamiento está cubierto por tests automatizados |
| Measured | El resultado cuantitativo lo produce un benchmark reproducible |
| Observed | Se observó en una ejecución específica, aún no es evidencia de release |
| Design target | Comportamiento intencional sin evidencia suficiente |

Reglas duras:

- Nunca se promueve el estado de evidencia.
- Un unit test no es un claim de performance.
- Una simulación determinista no es un resultado de modelo real.
- Reducción de contexto ≠ ahorro de tokens ≠ ahorro monetario.
- Investigación externa no es evidencia de que WAM logró lo mismo.

## Partición por capas

| Carpeta | Pregunta que responde | Change hijo |
| --- | --- | --- |
| `docs/concepts/` | QUÉ es el modelo | `doc-01-foundation` |
| `docs/claims/` | QUÉ se afirma y DÓNDE está la evidencia | `doc-02-claims` |
| `docs/architecture/` | CÓMO lo realiza el código | `doc-03-architecture` |
| `docs/validation/` | CÓMO se valida la premisa | `doc-04-validation` |
| `docs/benchmarks/` | CÓMO se miden los resultados | `doc-05-benchmarks` |

No se duplica la misma explicación entre capas: se enlaza.

## Decisiones explícitas

1. **No corregir artificialmente el benchmark para obtener el 60%.**
   Si el benchmark determinista da 69.6% y el dry-run da `netInputSavings < 0`,
   ambos permanecen visibles. El agente debe determinar qué mide cada experimento.

2. **El README no es un informe de auditoría.**
   El README cuenta arquitectura y valor. `docs/validation/` y
   `docs/benchmarks/` contienen la demostración. Se usa precisión positiva
   ("How we validate this") en lugar de secciones defensivas
   ("What WAM does not claim").

## Scope

Incluye la reescritura de README, concepts, claims, architecture, validation y
benchmarks, más `docs/AGENT_INSTRUCTIONS.md`. Excluye cambios de producción.

## Validation Strategy

- `node scripts/docs-check.mjs` — integridad de links.
- `openspec validate --all --strict` — integridad de changes.
- Grep de terminología obsoleta.
- Trazabilidad claim → código / test / artifact.

## Risks

- **Silent pass**: validación fail-closed; un claim sin referencia se marca
  `Design target`, no se asume verdadero.
- **Scope creep**: mantener cada change hijo enfocado en su capa.
- **Presión por el 60%**: no normar el benchmark contra el umbral; reportar
  as-is.
