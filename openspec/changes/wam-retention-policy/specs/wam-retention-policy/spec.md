# spec: wam-retention-policy

## Scope
`.wam/tasks/` — gestionar acumulación de directorios de tareas.

## Invariants
1. **Retention:** Solo se pueden purgar tareas con `status: COMPLETED` o `status: ARCHIVED` con antigüedad > WAM_RETENTION_TTL_DAYS (default 30).
2. **Protection:** No se pueden purgar tareas con `status: RUNNING`, `PENDING`, o que tengan `unknowns` activos.
3. **Schedule:** Ejecutarse al iniciar el plugin (`openspec run`) o por señal explícita (`openspec gc`).

## Fields
- `WAM_RETENTION_TTL_DAYS`: number (default 30)
- `WAM_RETENTION_MIN_PURGE_COUNT`: number (default 50 — inicia purga si `tasks/` > N)

## Hooks
- `onPluginStart` → `RetentionManager.maybePurge()`: si count(tasks/) > WAM_RETENTION_MIN_PURGE_COUNT, purgar las antiguas automáticamente.