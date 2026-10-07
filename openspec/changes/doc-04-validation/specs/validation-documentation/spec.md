# Validation Documentation

## ADDED Requirements

### Requirement: Premise validation document

MUST existir `docs/validation/premise.md` que describa la validación de la premisa
por comportamiento, no por existencia de componentes.

#### Scenario: Validación por existencia

- **WHEN** un test solo verifica que un componente existe
- **THEN** no cuenta como validación de la premisa

### Requirement: Causal decision matrix

MUST existir `docs/validation/causal-decision-matrix.md` con filas de variable,
control, perturbación y efecto esperado, marcadas PASS/FAIL/NOT IMPLEMENTED.

#### Scenario: Relación causal ausente

- **WHEN** la perturbación esperada no produce el cambio de decisión esperado
- **THEN** la fila se marca FAIL y la matriz se actualiza (no se fabrica PASS)
