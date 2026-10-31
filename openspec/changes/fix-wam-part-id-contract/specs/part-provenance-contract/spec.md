# Contrato de parts sintéticos

## ADDED Requirements

### Requirement: Identidad obligatoria de la parte sintética

Toda parte inyectada por WAM en la salida de `chat.message` MUST llevar un `id` de tipo string con
prefijo `prt_`. Si el llamador no provee un id válido, el sistema MUST generarlo; un id provisto por
el llamador MUST preservarse cuando es válido.

#### Scenario: Inyección sin id del llamador

- **WHEN** un llamador invoca `injectWamParts` con un string o un objeto sin `id`
- **THEN** la parte resultante lleva un `id` único con formato `prt_` + 16 hex
- **AND** `validateWamPart` la acepta

#### Scenario: Id válido provisto por el llamador

- **WHEN** la parte entrante ya trae un `id` que empieza con `prt_`
- **THEN** ese `id` se conserva sin regenerar

#### Scenario: Id malformado del llamador

- **WHEN** la parte entrante trae un `id` que no es un string no vacío con prefijo `prt_`
- **THEN** el id se reemplaza por uno generado y la parte sigue siendo válida

### Requirement: Inyección total, nunca destructiva

La inyección MUST NOT lanzar excepciones ni propagar partes inválidas. Una parte que no cumple el
contrato MUST descartarse, y el resto del lote MUST inyectarse; el descarte MUST quedar registrado
en el diagnóstico.

#### Scenario: Lote con una parte corrupta

- **WHEN** se inyecta un lote que contiene una parte sin texto y otra válida
- **THEN** la parte corrupta se descarta
- **AND** la parte válida se inyecta
- **AND** el retorno reporta `{ inserted: 1, dropped: 1 }`

#### Scenario: Parte de texto sin id (fallo de producción)

- **WHEN** se evalúa `validateWamPart({ type: "text", text: "x" })`
- **THEN** el resultado es `valid: false`
- **AND** los errores mencionan el `id`

### Requirement: Unicidad de id dentro del sink

Los ids inyectados MUST ser únicos respecto de las partes ya presentes en el destino y entre sí.
Ante colisión, el sistema MUST regenerar el id antes de insertar.

#### Scenario: Colisión con una parte existente

- **WHEN** el sink ya contiene `prt_0000000000000000` y se inyecta una parte con ese mismo id
- **THEN** la parte inyectada recibe un id distinto
- **AND** todos los ids del sink siguen siendo únicos

### Requirement: Generador único de ids

El sistema MUST exponer un único generador de ids de parte (`defaultPartId`) y MUST NOT mantener
generadores paralelos en los módulos consumidores.

#### Scenario: Consumidores existentes

- **WHEN** `index.js` o los handlers necesitan un id de parte
- **THEN** usan `defaultPartId` exportado por `part-provenance.js`
