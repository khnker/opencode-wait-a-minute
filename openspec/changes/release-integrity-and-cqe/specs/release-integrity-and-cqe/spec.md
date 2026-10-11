# CHANGE 01 — Release Integrity y Dependencia CQE

## Objetivo
Garantizar que WAM pueda empaquetarse, instalarse y ejecutarse desde un paquete npm limpio, sin depender de la estructura del checkout de desarrollo ni de directorios vecinos.

## Alcance
- `package.json`, `package-lock.json`
- `.npmignore` / `files`
- `scripts/verify-package.mjs`
- Workflow de CI existente
- Integración de `context-query-core`

## ADDED Requirements

### Requirement: REQ-01: CQE Distribution Strategy
**Given** WAM necesita integrar context-query-core  
**When** se publica el paquete npm  
**Then** la estrategia de distribución de CQE debe ser reproducible y compatible con publicación

#### Scenario: CQE published on npm
**Given** context-query-core está publicado como paquete npm  
**When** WAM declara la dependencia  
**Then** package.json referencia una versión semver válida y npm install resuelve correctamente

#### Scenario: CQE experimental - bundled
**Given** CQE no está publicado y es experimental  
**When** se construye el artefacto  
**Then** CQE se incluye explícitamente en el artefacto de WAM (no file: ni link:)

### Requirement: REQ-02: Package Verification Script
**Given** se ejecuta `scripts/verify-package.mjs`  
**When** se valida el paquete distribuible  
**Then** el script debe verificar el artefacto real, no el checkout

#### Scenario: Clean install verification
**Given** npm pack genera un tarball  
**When** se instala en directorio temporal aislado  
**Then** importar el paquete, instanciar plugin, ejecutar hooks reales, verificar modo CQE, limpiar aunque falle

#### Scenario: Invalid installedRoot handling
**Given** la ruta calculada no existe  
**When** verify-package.mjs detecta la inconsistencia  
**Then** falla explícitamente, no continúa con ruta inválida

### Requirement: REQ-03: Published Artifact Content
**Given** el paquete npm publicado  
**When** se inspecciona su contenido  
**Then** incluye todos los recursos requeridos por runtime (skills, configs, scripts)

#### Scenario: Skills directory included
**Given** skills/ existe en checkout  
**When** npm pack  
**Then** skills/ incluido en tarball

### Requirement: REQ-04: CI Integration
**Given** workflow de CI existente  
**When** se añade validación de paquete  
**Then** verify-package.mjs se ejecuta en CI sin duplicar pipelines

## Acceptance Criteria
- Paquete funciona fuera del checkout original
- No depende de `../context-query-core` salvo inclusión explícita
- No se omiten errores de instalación/importación
- CI verifica artefacto distribuible, no solo código fuente