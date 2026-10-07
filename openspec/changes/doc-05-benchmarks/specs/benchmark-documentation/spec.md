# Benchmark Documentation

## ADDED Requirements

### Requirement: Evidence class separation

La documentación de benchmarks MUST separar evidencia interna determinista,
empírica de provider y externa, y MUST NOT fusionarlas en un único número.

#### Scenario: Número fusionado

- **WHEN** se reporta un resultado de performance
- **THEN** pertenece a una sola clase de evidencia

### Requirement: Metric formulas

La documentación MUST definir `context reduction`, `WAM overhead` y
`net input savings`, y MUST NOT convertir reducción de contexto en ahorro de
tokens sin accounting.

#### Scenario: Resultado negativo

- **WHEN** el dry-run produce `netInputSavings < 0`
- **THEN** se reporta como tal y no se combina con la evidencia determinista

### Requirement: Results traceability

`docs/benchmarks/results.md` MUST derivarse de los artifacts generados en
`benchmarks/reports/rc1/` y MUST identificar la fuente de cada valor.

#### Scenario: Valor desactualizado

- **WHEN** el artifact generado difiere del valor documentado
- **THEN** se actualiza el documento, no el artifact
