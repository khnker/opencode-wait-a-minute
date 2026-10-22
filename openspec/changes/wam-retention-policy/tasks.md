# Tasks: wam-retention-policy

- [x] T1: Definir configuración `WAM_RETENTION_TTL_DAYS` en `src/config/wam-config.js` (default 30).
- [x] T2: Implementar `RetentionManager` en `src/persistence/retention-manager.js` con método `purge()` asíncrono.
- [x] T3: Implementar filtrado por estado (`COMPLETED`/`ARCHIVED` + fecha > TTL) y protección de tareas activas.
- [x] T4: Integrar hook `onPluginStart` que invoque `purge()` cuando `tasks/` supere umbral mínimo.
- [x] T5: Tests unitarios: verificar que no purga `RUNNING`, purga `COMPLETED` viejas, respeta TTL.
- [x] T6: Tests de integración: simular directorio con >50 tareas mixtas y verificar limpieza.