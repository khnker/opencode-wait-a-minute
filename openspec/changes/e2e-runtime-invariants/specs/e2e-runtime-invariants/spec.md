# CHANGE 05 — Add End-to-End Runtime Invariant Tests

## Objetivo
Verificar que las garantías de WAM se mantienen al atravesar el ciclo de vida real del plugin OpenCode, y no solo en pruebas unitarias de módulos aislados.

## Alcance
- Hook de entrada del plugin.
- `tool.execute.before` y hooks relacionados.
- `src/execution/runtime-guards.js`
- Gobernanza y clasificación de acciones.
- Contexto y CQE.
- Persistencia de tareas y auditoría.
- Transiciones de estado.
- Harness de integración de pruebas.

## ADDED Requirements

### Requirement: REQ-05-01: Runtime Harness
**Given** se necesita un harness reutilizable  
**When** se instancia el plugin con directorios temporales y fixtures controlados  
**Then** debe permitir: ejecutar hooks reales, inyectar fallos de dependencias, inspeccionar decisiones, reiniciar conservando estado, ejecutar escenarios concurrentes con sesiones independientes  

#### Scenario: Harness creates isolated env
**Given** harness initialized  
**When** plugin instantiated with temp dir  
**Then** hooks reales ejecutables, estado aislado por sesión  

### Requirement: REQ-05-02: Invariant I1 — Fail-closed
**Given** herramienta no catalogada  
**When** contrato de WAM exige bloquearla  
**Then** herramienta NO llega a ejecutarse  

#### Scenario: Blocked tool
**Given** herramienta `rm -rf /` no en lista permitida  
**When** hook `tool.execute.before` intercepta  
**Then** operación abortada, error devuelto al llamador  

### Requirement: REQ-05-03: Invariant I2 — Session isolation
**Given** dos sesiones distintas  
**When** una lee evidencia de otra  
**Then** NO se acepta como válida para autorizar acción  

#### Scenario: Cross-session read
**Given** sesión A lee `/file.js`  
**When** sesión B intenta usar evidencia de A  
**Then** evidencia rechazada, requiere nueva lectura en B  

### Requirement: REQ-05-04: Invariant I3 — Evidence freshness
**Given** contenido modificado después de lectura  
**When** se usa evidencia obsoleta  
**Then** evidencia considerada inválida  

#### Scenario: Stale evidence after change
**Given** versión v1 leída, luego se escribe v2  
**When** transición basada en v1  
**Then** transición denegada, se requiere lectura de v2  

### Requirement: REQ-05-05: Invariant I4 — Completion integrity
**Given** transición a `VERIFIED` o `DONE` requiere evidencia obligatoria  
**When** falta evidencia obligatoria  
**Then** transición NO alcanzada  

#### Scenario: Missing mandatory evidence
**Given** transition to VERIFIED requires audit log  
**When** audit log missing  
**Then** estado permanece en IN_PROGRESS o similar  

### Requirement: REQ-05-06: Invariant I5 — Retrieval containment
**Given** resultado de CQE con ruta  
**When** se procesa resultado  
**Then** lectura fuera de ámbito autorizado NO ocurre  

#### Scenario: Out-of-bounds path
**Given** CQE retorna `/etc/passwd`  
**When** WAM procesa resultado  
**Then** lectura bloqueada, fallback a nativo o error  

### Requirement: REQ-05-07: Invariant I6 — Recovery
**Given** reinicio durante operación incompleta  
**When** estado persistido usado para autorizar acción  
**Then** transición NO producida sin evidencia persistente que la sustente  

#### Scenario: Corrupt persistence after crash
**Given** estado persistido parcial o corrupto  
**When** reinicio y intento de autorizar  
**Then** denegado conservadoramente, no asume validez  

### Requirement: REQ-05-08: Invariant I7 — Governance consistency
**Given** políticas aplicadas en sesión principal y subagentes  
**When** excepción explícita del contrato  
**Then** coherencia mantenida, excepción solo donde permitida  

#### Scenario: Subagent inherits policy
**Given** sesión principal permite X  
**When** subagente ejecuta Y no permitido  
**Then** bloqueado por política heredada  

### Requirement: REQ-05-09: Invariant I8 — Bounded execution
**Given** proveedor lento o fallido  
**When** se realizan consultas  
**Then** consultas, reintentos, tareas pendientes tienen límite superior  

#### Scenario: Slow provider
**Given** proveedor responde tras timeout  
**When** se intenta consulta  
**Then** número de reintentos limitado, tareas pendientes acotadas  

## Acceptance Criteria
- Cada invariante tiene al menos una prueba que atraviesa el runtime
- Las pruebas comprueban efectos reales sobre la ejecución y la persistencia
- Los escenarios de reinicio y concurrencia están cubiertos
- Los fallos de seguridad no se convierten en warnings inocuos
- La suite completa puede ejecutarse localmente y en CI con los mismos resultados esperados