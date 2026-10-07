# Documentation Integrity

## ADDED Requirements

### Requirement: Evidence-status discipline

Toda afirmación fuerte en la documentación MUST declarar uno de los estados
`Implemented`, `Tested`, `Measured`, `Observed` o `Design target`, y MUST NOT
declararse con un estado superior al que su evidencia sostiene.

#### Scenario: Claim sin evidencia

- **WHEN** un claim no tiene implementación ni test ni artifact que lo respalde
- **THEN** se documenta como `Design target`

#### Scenario: Claim medido

- **WHEN** un claim es cuantitativo
- **THEN** referencia el artifact reproducible que lo produjo en
  `benchmarks/reports/rc1/`

### Requirement: State/context separation language

La documentación MUST describir el estado de tarea persistente como distinto del
contexto transitorio del modelo, y MUST NOT tratar el estado persistente como
contexto de modelo.

#### Scenario: Reconstrucción de contexto

- **WHEN** se explica cómo se arma el contexto enviado al modelo
- **THEN** se describe como reconstrucción desde el estado de la tarea actual

### Requirement: Terminology migration

La documentación MUST NOT usar "pre-flight" ni "cognitive gate" como concepto
arquitectónico primario.

#### Scenario: Términos obsoletos

- **WHEN** la documentación describe la arquitectura de WAM
- **THEN** usa control determinista / estado de tarea / enriquecimiento de
  contexto / optimización de tokens como conceptos primarios

### Requirement: Metric separation

La documentación MUST separar `context reduction`, `WAM overhead`,
`net input savings` y `provider cost`, y MUST NOT convertir uno en otro sin
accounting explícito.

#### Scenario: Reducción de contexto reportada

- **WHEN** se reporta una reducción de contexto
- **THEN** se identifica baseline, contexto WAM, overhead y método de medición

### Requirement: Link integrity

Todo link Markdown relativo de la documentación MUST resolver, y toda referencia
a archivo de código, test o benchmark MUST existir.

#### Scenario: Chequeo de documentación

- **WHEN** se ejecuta `node scripts/docs-check.mjs`
- **THEN** no hay links rotos ni rutas inexistentes

### Requirement: Layer separation

La documentación MUST organizarse en capas (concepts, claims, architecture,
validation, benchmarks) sin duplicar la misma explicación entre capas.

#### Scenario: Explicación duplicada

- **WHEN** una explicación ya existe en otra capa
- **THEN** se enlaza en lugar de repetirse
