# Integrate Impeccable Frontend UX — Tasks

## Implementation
1. [ ] Record Impeccable provenance (license, revision, supported agents, install mechanism, command definitions, dependencies).
2. [ ] Detect capability state: `unavailable` / `available-but-disabled` / `enabled` (read-only probe, no downloads).
3. [ ] Add opt-in configuration flag (default disabled); never overwrite user config.
4. [ ] Add frontend UX task classifier (backend-only tasks are never classified as frontend UX).
5. [ ] Add delegation adapter for compatible frontend UX tasks when `enabled`.
6. [ ] Return explicit fallback status for `unavailable` / unsupported command / unsupported agent without fabricated success.
7. [ ] Keep integration logic out of the completion gate and `DONE` semantics.
8. [ ] Tests: disabled → unchanged; unavailable → graceful fallback with explicit status; enabled → supported frontend tasks delegate; backend-only → no activation; unsupported command/agent → explicit fallback; existing outcome/lifecycle tests stay green; user config unchanged.

## Verificación
9. [ ] Suite completa (npm test)
10. [ ] `openspec validate --changes`
