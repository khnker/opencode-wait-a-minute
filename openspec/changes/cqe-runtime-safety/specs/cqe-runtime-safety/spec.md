# CHANGE 02 — Harden CQE Retrieval Boundaries

## Objetivo
Garantizar que la recuperación de contexto mediante CQE no pueda leer archivos fuera del repositorio autorizado, mezclar resultados entre proyectos ni consumir recursos indefinidamente.

## Alcance
- `src/context/cqe-adapter.js`
- `src/context/context.js`
- Configuración de CQE existente
- Pruebas del adaptador y de integración del runtime

## ADDED Requirements

### Requirement: REQ-02-01: Path Validation for CQE Results
**Given** CQE returns a result with a file path  
**When** WAM processes the result  
**Then** it SHALL resolve the path wrt. the authorized repo root using `path.resolve` and reject paths that escape the repo boundary  

#### Scenario: Valid path within root
**Given** root = `/repo/project`  
**When** CQE returns `/repo/project/src/file.js`  
**Then** WAM allows reading the file  

#### Scenario: Absolute path outside root
**Given** root = `/repo/project`  
**When** CQE returns `/repo-other/file.js`  
**Then** WAM rejects the path  

#### Scenario: Traversal via `..`
**Given** root = `/repo/project`  
**When** CQE returns `/repo/project/../secret.js`  
**Then** WAM rejects the path  

#### Scenario: Symlink escape
**Given** root = `/repo/project` and a symlink pointing outside  
**When** CQE resolves through symlink  
**Then** WAM rejects the resolved real path  

#### Scenario: Similar prefixes between roots
**Given** root = `/repo/project`  
**When** path = `/repo/project-evil/file.js`  
**Then** WAM rejects the path  

### Requirement: REQ-02-02: Execution Boundaries and Timeout Handling
**Given** a CQE query runs with a timeout limit  
**When** the query exceeds the configured timeout  
**Then** WAM SHALL abort the query via `AbortSignal` or safe discard; it SHALL NOT count aborted queries as in-flight  

#### Scenario: Normal completion within timeout
**Given** query finishes before timeout  
**When** timeout configured at 5000ms  
**Then** result is returned normally  

#### Scenario: Late result after timeout
**Given** query is aborted at 5000ms  
**When** result arrives at 7000ms  
**Then** result is discarded safely, no memory leak  

#### Scenario: Concurrent query limits
**Given** 5 concurrent queries  
**When** limit set to 3  
**Then** 2 are queued; no unbounded growth  

### Requirement: REQ-02-03: Per-Project Instance Isolation
**Given** two distinct repo roots  
**When** CQE operates on root A  
**Then** it SHALL NOT serve results from root B without explicit multi-root design

#### Scenario: Different roots
**Given** root1 = `/repo-a`, root2 = `/repo-b`  
**When** CQE instance created for root1  
**Then** root2 files are never served by this instance  

#### Scenario: Session/project boundary
**Given** session starts with root = `/repo-a`  
**When** project changes to `/repo-b`  
**Then** CQE instance MUST be invalidated before serving new queries

## Acceptance Criteria
- Ningún resultado de CQE provoca lectura fuera de ámbito autorizado
- No hay contaminación entre proyectos
- Timeout no causa crecimiento ilimitado de consultas activas
- Fallback conserva comportamiento y es observable mediante pruebas