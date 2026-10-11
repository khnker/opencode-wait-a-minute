# CHANGE 04 — Replace Synthetic Token Claims with Reproducible Benchmarks

## Objetivo
Eliminar los resultados de ahorro que dependen de un baseline fijo o de estimaciones de tokens no verificadas, y establecer un protocolo de benchmark que mida el coste real y la calidad de WAM.

## Alcance
- `benchmarks/lifecycle-token-savings.mjs`
- Infraestructura de benchmarks existente.
- Fixtures y datasets.
- Documentación de resultados y claims del README.
- Scripts locales de validación.

## ADDED Requirements

### Requirement: REQ-04-01: Remove Artificial Baseline
**Given** benchmark actual usa `monolithicTokens = 1500` como baseline empírico  
**When** se ejecuta benchmark  
**Then** no debe presentar estimación `text.length / 4` como conteo real de tokens  
**Then** identificarlo explícitamente como estimación exploratoria si se mantiene  
**Then** no usarlo para justificar claim de ahorro

#### Scenario: Baseline removed
**Given** `benchmarks/lifecycle-token-savings.mjs` sin baseline fijo  
**When** se ejecuta  
**Then** no afirma ahorro basado en 1500 tokens fijos

### Requirement: REQ-04-02: Equivalent Case Definition
**Given** conjunto versionado de tareas representativas  
**When** se ejecutan bajo dos condiciones: baseline sin optimización y WAM con optimización  
**Then** ambas condiciones reciben las mismas tareas, archivos iniciales, criterios de aceptación y restricciones  
**Then** documentar qué componentes están activos en cada condición

#### Scenario: Task equivalence
**Given** fixtures `benchmarks/fixtures/equivalent-tasks.json`  
**When** baseline y WAM reciben idéntico input  
**Then** diferencias atribuibles solo a optimización evaluada

### Requirement: REQ-04-03: Token Measurement with Real Tokenizer
**Given** tokenizador correspondiente al modelo cuando está disponible  
**When** benchmark usa proveedor real  
**Then** registrar: proveedor, modelo, identificador/versión tokenizador, tokens entrada/salida reportados, tokens contexto añadidos por WAM, costes de recuperación/herramientas/reintentos, limitaciones de contadores

#### Scenario: Real tokenizer
**Given** proveedor reporta tokens reales  
**When** benchmark registra métricas  
**Then** tokens distinguibles de estimaciones locales  
**Then** no mezclar tokens de modelos distintos sin normalización

### Requirement: REQ-04-04: Separated Metrics Reporting
**Given** reportar al menos: tokens entrada, tokens salida, tokens totales, latencia total y distribución, tasa de éxito, reintentos, errores recuperación/fallback, coste monetario, calidad resultado  
**When** calcular ahorro relativo respecto al baseline de la misma tarea  
**Then** reportar mediana y dispersión además de promedio cuando hay variabilidad

#### Scenario: Metric separation
**Given** resultados de benchmark  
**When** se genera reporte  
**Then` tokens entrada, salida, total, latencia, éxito, reintentos, errores, coste, calidad separadamente

### Requirement: REQ-04-05: Local Real-LLM Validation
**Given** benchmark con LLM reales como validación local explícita  
**When** no reproducible en GitHub Actions  
**Then** comando determinista en configuración, validar variables necesarias, guardar resultados con metadatos  
**Then** benchmarks sintéticos y sin proveedor siguen disponibles para regresiones rápidas  
**Then** no presentarlos como evidencia de ahorro real

#### Scenario: Local LLM benchmark
**Given** variables de entorno configuradas  
**When** se ejecuta benchmark real  
**Then** resultados guardados con metadatos suficientes  
**Then** comando `npm run bench:llm-real` funciona localmente

### Requirement: REQ-04-06: Result Integrity and Auditable Artifacts
**Given** cada ejecución produce artefacto con: commit evaluado, versión benchmark, configuración efectiva, dataset y hash, modelo y proveedor, resultados por caso, fallos y exclusiones, resumen estadístico  
**When** se ejecuta benchmark  
**Then** no sobrescribir silenciosamente resultados incompatibles  
**Then** no eliminar ejecuciones fallidas del denominador sin declararlo

#### Scenario: Artifact integrity
**Given** benchmark ejecutado  
**When** se genera artefacto  
**Then** contiene todos los campos requeridos  
**Then** fallos contabilizados explícitamente

### Requirement: REQ-04-07: Public Claims Alignment
**Given** README y documentación de evidencias  
**When** porcentaje publicado  
**Then** debe apuntar a resultado reproducible y explicar baseline y condiciones  
**Then** si no hay datos suficientes, retirar temporalmente el porcentaje en lugar de estimarlo

#### Scenario: Claim withdrawal
**Given** datos insuficientes para claim  
**When** documentación actualizada  
**Then** claim retirado temporalmente, no sustituido por estimación

## Acceptance Criteria
- Ningún claim de ahorro depende de baseline fijo no medido
- Métricas de coste y calidad son separables
- Benchmarks locales con LLM reales no son requisito ficticio de CI
- Resultados son auditables desde commit y configuración