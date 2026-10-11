# CHANGE 05 — End-to-End Runtime Invariant Tests — Tasks

## Tasks List

### [T-01] Create runtime test harness
- Implementar `test/harness/runtime-harness.js` que:
  - Crea directorios temporales para proyecto y estado
  - Instancia el plugin real con configuración controlada
  - Permite inyectar fallos de dependencias (CQE, fs, etc.)
  - Expone API para ejecutar hooks reales (`tool.execute.before`, etc.)
  - Permite inspeccionar decisiones, argumentos y efectos observables
  - Soporta reinicio del plugin conservando directorio de estado
  - Permite ejecutar escenarios concurrentes con sesiones independientes
  - Limpieza automática de recursos

### [T-02] Implement invariant I1 — Fail-closed
- Crear `tests/unit/runtime/invariant-fail-closed.test.mjs`:
  - Intenta ejecutar herramienta no catalogada (ej. `rm -rf /`)
  - Verifica que `tool.execute.before` la bloquee
  - Confirmar que la operación nunca se ejecuta efectivamente
  - Usar harness para aislar entorno

### [T-03] Implement invariant I2 — Session isolation
- Crear `tests/unit/runtime/invariant-session-isolation.test.mjs`:
  - Dos sesiones distintas leen el mismo archivo
  - Verifica que evidencia de sesión A no sea válida en sesión B
  - Cada sesión debe realizar su propia lectura para autorizar acción

### [T-04] Implement invariant I3 — Evidence freshness
- Crear `tests/unit/runtime/invariant-evidence-freshness.test.mjs`:
  - Lectura inicial de archivo v1
  - Modificación externa a v2
  - Intento de usar evidencia v1 para transición
  - Verifica que se rechace y se requiera nueva lectura

### [T-05] Implement invariant I4 — Completion integrity
- Crear `tests/unit/runtime/invariant-completion-integrity.test.mjs`:
  - Definir transición que requiera evidencia obligatoria (ej. audit log)
  - Intento de transitar a `VERIFIED` sin evidencia
  - Verifica que estado no avance a `VERIFIED`
  - Evidencia presente permite transición

### [T-06] Implement invariant I5 — Retrieval containment
- Crear `tests/unit/runtime/invariant-retrieval-containment.test.mjs`:
  - Simular CQE que retorna ruta fuera de ámbito (`/etc/passwd`)
  - Verifica que lectura esté bloqueada o fallback a nativo
  - Ninguna lectura real ocurre fuera de directorio autorizado

### [T-07] Implement invariant I6 — Recovery
- Crear `tests/unit/runtime/invariant-recovery.test.mjs`:
  - Guardar estado persistido parcial o corrupto
  - Reiniciar plugin e intentar autorizar acción
  - Verifica comportamiento conservador (denegar si no hay evidencia válida)
  - Estado válido permite recuperación

### [T-08] Implement invariant I7 — Governance consistency
- Crear `tests/unit/runtime/invariant-governance-consistency.test.mjs`:
  - Sesión principal permite acción X
  - Subagente intenta acción Y no permitida por contrato
  - Verifica que subagente sea bloqueado por política heredada
  - Excepciones explícitas del contrato respetadas

### [T-09] Implement invariant I8 — Bounded execution
- Crear `tests/unit/runtime/invariant-bounded-execution.test.mjs`:
  - Proveedor lento que responde tras timeout
  - Verifica número limitado de reintentos
  - Tareas pendientes no crecen indefinidamente
  - Límite superior configurado y respetado

### [T-10] Integrate into CI and local scripts
- Añadir `npm test:e2e-invariants` que ejecute todas las pruebas de invariantes
- Asegurar que `npm test` incluye las nuevas pruebas (o crear script separado)
- Verificar que pruebas pasan en CI con mismos resultados esperados

## Criterios de aceptación
- Cada invariante tiene al menos una prueba que atraviesa el runtime
- Las pruebas comprueban efectos reales sobre la ejecución y la persistencia
- Los escenarios de reinicio y concurrencia están cubiertos
- Los fallos de seguridad no se convierten en warnings inocuos
- La suite completa puede ejecutarse localmente y en CI con los mismos resultados esperados