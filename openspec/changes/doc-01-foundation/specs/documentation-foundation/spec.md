# Documentation Foundation

## ADDED Requirements

### Requirement: Documentation agent instructions

El repositorio MUST incluir `docs/AGENT_INSTRUCTIONS.md` que obligue a inspeccionar
`src/`, `tests/`, `benchmarks/` y la documentación existente antes de escribir.

#### Scenario: Manual presente

- **WHEN** se revisa `docs/AGENT_INSTRUCTIONS.md`
- **THEN** contiene secciones de análisis obligatorio, disciplina de evidencia
  y reporte final requerido

### Requirement: README core model

El README MUST presentar la separación estado/contexto y la frase
"WAM keeps more state than it sends", y MUST NOT usar "Cognitive Gate" ni
"pre-flight" como concepto arquitectónico primario.

#### Scenario: Lectura rápida

- **WHEN** se lee el README
- **THEN** responde qué es WAM, qué problema resuelve, la idea arquitectónica
  central y dónde está la evidencia

### Requirement: Concept documents

MUST existir un documento por concepto en `docs/concepts/` que explique el modelo
conceptual y enlace a su implementación.

#### Scenario: Conceptos presentes

- **WHEN** se listan `docs/concepts/`
- **THEN** existen state-vs-context, task-context-lifecycle, context-separation,
  context-enrichment y evidence-driven-state
