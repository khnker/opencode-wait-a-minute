# CHANGE 03 — Enforce Session Isolation and Evidence Integrity

## Objetivo
Evitar que las lecturas, decisiones de contexto y evidencias de una sesión influyan indebidamente en otra. Impedir que WAM marque una tarea como verificada cuando falta evidencia obligatoria o esta ha quedado obsoleta.

## Alcance
- `src/context/session-file-read-ledger.js`
- `src/execution/runtime-guards.js`
- `src/context/context.js`
- `src/persistence/audit-coalescer.js`
- Persistencia y transición de estado de tareas.
- Pruebas de concurrencia y recuperación.

## ADDED Requirements

### Requirement: REQ-03-01: Session-Bound Ledger Identity
**Given** cada registro debe asociarse al menos con: root canónico, identificador de sesión, ruta canónica del archivo, digest del contenido observado, instante de lectura, versión o revisión  
**When** se crea un registro de lectura  
**Then** la clave compuesta debe impedir que una lectura realizada en otra sesión se considere redundante o válida para una edición actual

#### Scenario: Redundancy check across sessions
**Given** sesión A lee `/file.js` con digest ABC  
**When** sesión B (distinta) lee `/file.js` con digest ABC  
**Then** sesión B NO considera la lectura de A como redundante o válida

### Requirement: REQ-03-02: Change Detection Contract
**Given** `isRedundant`, `recordRead` y `checkStale` deben seguir el contrato  
**When** una lectura es redundante solo respecto de una observación equivalente en el mismo ámbito  
**When** una modificación posterior invalida la observación anterior  
**When** un archivo inexistente o inaccesible no puede considerarse validado  
**When** una edición basada en buffer obsoleto debe exigir nueva lectura

#### Scenario: Change invalidates prior observation
**Given** sesión lee `/file.js`, contenido versionado v1  
**When** se modifica archivo a v2  
**When** sesión intenta usar evidencia v1  
**Then** la evidencia v1 está obsoleta; requiere nueva lectura

### Requirement: REQ-03-03: Lifecycle and Recovery
**Given** al reiniciar, no recuperar observaciones como actuales si no pueden validarse  
**When** se usan datos persistidos para autorizar una acción  
**Then** revalidar datos persistidos; tratar registros incompletos o corruptos de forma conservadora

#### Scenario: Recovery with partial records
**Given** reinicio con ledger parcial  
**When** se intenta autorizar acción basada en registros  
**Then** revalidar datos persistidos; si no pueden validarse, denegar conservadoramente

### Requirement: REQ-03-04: Mandatory vs Optional Evidence
**Given** dos clases de registros: diagnóstico opcional y evidencia obligatoria  
**When** transición de estado exige VERIFIED o DONE  
**Then** evidencia obligatoria ausente o corrupta debe impedir esa transición

#### Scenario: Verification without mandatory evidence
**Given** transición a VERIFIED requiere evidencia obligatoria  
**When** evidencia obligatoria no está  
**Then** transición NO se permite, pero logging opcional no bloquea

### Requirement: REQ-03-05: Audit Coalescence Guarantees
**Given** coalescence optimización no debe desechar eventos necesarios para reconstruir decisión  
**When** eventos de transición si coalesce elimina evidencia  
**When** mantener orden de eventos relevantes  
**When** definir cómo se informa un fallo de flush  
**Evitar duplicados al reintentar persistencia con identificadores de evento**

#### Scenario: Coalesce preserves transitions
**Given** secuencia de eventos de decisión  
**When** coalesce optimización  
**Then** eventos de transición preservados, no se descartan necesarios para reconstruir decisión

## Acceptance Criteria
- No existe contaminación de estado entre sesiones
- Los datos obsoletos no se aceptan como evidencia actual
- Los errores de diagnóstico opcional no bloquean innecesariamente al agente
- Los errores de evidencia obligatoria impiden una verificación no sustentada
- La recuperación después de un reinicio es determinista y está cubierta por pruebas