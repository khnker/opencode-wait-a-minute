# Claims Documentation

## ADDED Requirements

### Requirement: Claim evidence traceability

Cada claim MUST identificar su implementación, sus tests y, cuando aplique, su
evidencia de benchmark, además de su estado de evidencia.

#### Scenario: Claim sin referencia

- **WHEN** un claim no puede trazarse a código o test
- **THEN** se marca `Design target` y se registra el gap

### Requirement: Evidence status model

`docs/claims/README.md` MUST definir los estados de evidencia y la regla de no
promoción.

#### Scenario: Estado definido

- **WHEN** se revisa `docs/claims/README.md`
- **THEN** contiene la tabla de estados y la regla "never upgrade evidence status"

### Requirement: Deterministic control claim

MUST existir `docs/claims/deterministic-control.md` que determine si la
determinación de decisiones está garantizada por la implementación o si debe
documentarse la proposición más fuerte soportada por el código.

#### Scenario: Determinismo no garantizado

- **WHEN** existen entradas no deterministas (tiempo, aleatoriedad, modelo)
- **THEN** se documenta su alcance y la validación faltante
