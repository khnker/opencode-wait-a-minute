# CHANGE 04 — Reproducible Benchmarks and Verifiable Claims — Tasks

## Tasks List

### [T-01] Remove synthetic baseline
- Eliminar `monolithicTokens = 1500` de `benchmarks/lifecycle-token-savings.mjs`
- Separar estimación local (`text.length / 4`) de tokens medidos del proveedor
- Identificar explícitamente cada estimación
- No presentar ninguna estimación como claim de ahorro

### [T-02] Create equivalent case dataset
- Crear `benchmarks/fixtures/equivalent-tasks.json` con tareas versionadas
- Definir fixtures para: baseline sin optimización, WAM con optimización
- Documentar componentes activos en cada condición
- Hash del dataset para reproducibilidad

### [T-03] Real token measurement
- Implementar medición con tokenizador real del modelo (OpenAI tokenizer si disponible)
- Registrar metadatos: proveedor, modelo, tokenizador, entrada, salida, contexto WAM, reintentos
- Separar tokens estimados de tokens medidos
- Normalizar comparaciones entre modelos distintos

### [T-04] Metric reporting
- Reportar: tokens entrada, salida, total, latencia + distribución, éxito, reintentos, errores, coste, calidad
- Calcular mediana/dispersión además de promedio
- Artifacts con commit, versión, config, dataset hash, modelo, fallos, resumen estadístico

### [T-05] Local LLM validation
- Comando `npm run bench:llm-real` para validación con LLM real local
- Variables de entorno obligatorias (API key)
- Guardar resultados con metadatos completos
- No incluir en CI, solo local

### [T-06] Claims alignment
- Revisar README y docs para claims de ahorro
- Retirar porcentajes sin datos medidos
- Asegurar cada claim apunta a artifact reproducible

## Criterios de aceptación
- Ningún claim de ahorro depende de baseline fijo no medido
- Métricas de coste y calidad son separables
- Benchmarks locales con LLM reales no son requisito ficticio de CI
- Resultados son auditables desde commit y configuración