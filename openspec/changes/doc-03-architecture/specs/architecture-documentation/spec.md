# Architecture Documentation

## ADDED Requirements

### Requirement: Task lifecycle source of truth

`docs/architecture/task-lifecycle.md` MUST reflejar exactamente los estados y
transiciones de `src/execution/execution-state.js`.

#### Scenario: Transición no implementada

- **WHEN** el diagrama propone una transición ausente en `ALLOWED_TRANSITIONS`
- **THEN** el diagrama se corrige para coincidir con la implementación

### Requirement: State persistence accuracy

`docs/architecture/state-persistence.md` MUST documentar el store real y MUST NOT
afirmar persistencia entre reinicios de proceso salvo que la implementación la
demuestre.

#### Scenario: Persistencia no demostrada

- **WHEN** la implementación no garantiza persistencia en restart
- **THEN** el documento lo declara explícitamente

### Requirement: Invariants verified

`docs/architecture/invariants.md` MUST listar solo invariantes verificados contra
código y tests, sin duplicados.

#### Scenario: Invariante no aplicado

- **WHEN** un candidato a invariante no está enforced por el código
- **THEN** se elimina o se marca como no aplicado
