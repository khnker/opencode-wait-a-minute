# CHANGE 05 — End-to-End Runtime Invariant Tests — Start

## Change Entry Point

This change introduces end-to-end runtime invariant tests to verify WAM guarantees hold across the full OpenCode plugin lifecycle.

## Dependencies

- CHANGE 01 (Release integrity & CQE distribution) — must be published first
- CHANGE 02 (CQE runtime safety) — required for retrieval containment invariant
- CHANGE 03 (Session isolation & evidence integrity) — required for session/evidence/recovery invariants
- CHANGE 04 (Reproducible benchmarks) — recommended for measurement baseline

## Implementation Plan

1. **Harness**: `test/harness/runtime-harness.js`
2. **Invariants I1-I8** as separate test files in `tests/unit/runtime/`
3. **Integration**: `npm test:e2e-invariants`, CI integration

## Acceptance Criteria

- Cada invariante tiene al menos una prueba que atraviesa el runtime
- Las pruebas comprueban efectos reales sobre la ejecución y la persistencia
- Los escenarios de reinicio y concurrencia están cubiertos
- Los fallos de seguridad no se convierten en warnings inocuos
- La suite completa puede ejecutarse localmente y en CI con los mismos resultados esperados

## Related

- `openspec/changes/e2e-runtime-invariants/specs/e2e-runtime-invariants/spec.md`
- `openspec/changes/e2e-runtime-invariants/tasks.md`