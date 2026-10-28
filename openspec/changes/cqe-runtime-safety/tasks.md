# CHANGE 02 — CQE Runtime Safety and Isolation — Tasks

## Tasks List

### [T-01] Implement path validation for CQE results
- [x] Crear `src/context/path-validator.js` con:
  - [x] Función `validatePath(path, repoRoot)` que canonicen, resuelvan enlaces, verifiquen límites y devuelvan `null` si inválida
  - [x] Integrar llamada justo antes de cada operación de lectura en `cqe-adapter.js`
  - [x] Probar validación contra: ruta válida, `..`, absoluta externa, prefijos similares

### [T-02] Implementar límites de ejecución y timeouts
- Revisar y completar `src/context/cqe-adapter.js`:
  - [x] Configurar `Promise.race` con timeout configurable (mín 1ms, máx 30000ms)
  - [x] Implementar cancelación: el engine síncrono solo se interrumpe fuera del hilo principal (`worker.terminate()`); `useWorker:false` degrada a timeout descartable
  - [x] Limpiar recursos (clearTimeout, AbortSignal) al cerrar sesión
  - [ ] Métricas: tiempo real vs. timeout, resultado descartado vs. devuelto

### [T-03] Aislamiento por proyecto
- [ ] Definir identidad del root canónico en `src/context/context.js`
- [ ] Añadir `root` al contexto de cada sesión/instancia CQE
- [x] Prohibir reutilización entre roots sin reinicialización explícita
- [x] Probar con dos repositorios diferentes usando fixtures

### [T-04] Fallback nativo existente
- Documentar modos `disabled`, `shadow`, `enabled` en `src/context/context.js`
- Asegurar que `shadow` compara resultados sin sustituir el nativo
- `enabled` recurre al nativo ante errores recuperables
- Probar escenarios: CQE error, CQE resultado inválido, fallback verificado

### [T-05] Observabilidad estructurada
- Añadir logging de modo, duración, motivo fallback y resultados descartados
- No registrar contenido sensible ni credenciales
- Guardar métricas opcionales para diagnóstico sin bloquear operación
- Probar logging bajo fallos y éxito

## Criterios de aceptación
- Ningún resultado de CQE provoca lectura fuera de ámbito autorizado
- No hay contaminación entre proyectos
- Timeout no causa crecimiento ilimitado de consultas activas
- Fallback conserva comportamiento y es observable mediante pruebas