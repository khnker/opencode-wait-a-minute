# spec: wam-retention-policy

## ADDED Requirements

### Requirement: Retention Management
The WAM system MUST provide a garbage collection mechanism to prevent task directory accumulation.

#### Scenario: Purge Eligibility
- **WHEN** the plugin starts or `openspec gc` is called
- **THEN** it identifies tasks with `status: COMPLETED` or `status: ARCHIVED` older than WAM_RETENTION_TTL_DAYS
- **AND** it ensures tasks with `status: RUNNING` or `PENDING` are never purged.

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
