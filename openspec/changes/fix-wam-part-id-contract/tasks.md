# Contrato de parts sintéticos — Tasks

## Diagnóstico

1. [x] Reproducir el fallo desde el log de OpenCode (`invalid user part before save`, `partID=undefined`, `wamPhase=cpc`).
2. [x] Trazar la cadena `index.js:1276` → `injectCanonicalProjectContext` → `injectWamParts` → `tagWamPart`.
3. [x] Medir alcance: 31 fallos en ~20 sesiones (2026-10-30T23:11Z → 2026-10-31T01:28Z).

## Especificación

4. [x] Definir la invariante: toda parte inyectada cumple el contrato o no se inyecta.
5. [x] Comparar alternativas (parche por call site / función total en la frontera / schema completo) en `design.md`.

## Implementación

6. [x] `src/integration/part-provenance.js`: `defaultPartId` (CSPRNG) + `PART_ID_PREFIX`.
7. [x] `src/integration/part-provenance.js`: `tagWamPart` genera `id` por defecto y normaliza strings/objetos.
8. [x] `src/integration/part-provenance.js`: `validateWamPart` con los requisitos de OpenCode 1.19.4.
9. [x] `src/integration/part-provenance.js`: `injectWamParts` deduplica ids, descarta inválidos y devuelve `{inserted, dropped}`.
10. [x] `index.js`: eliminar el `genPartId` local y usar `defaultPartId` como generador único.
11. [x] `src/context/canonical-project-context.js`: propagar `idFactory` en la inyección CPC.
12. [x] `index.js`: pasar `idFactory: genPartId` al inyectar CPC (defensa en profundidad).

## Pruebas

13. [x] `tests/unit/part-provenance-contract.test.mjs` (8 casos, incluye la llamada exacta del CPC).
14. [x] `tests/unit/completion-gate-validation.test.mjs`: exigir `id` en el test de schema 1.19.
15. [x] Comprobar que el test nuevo falla con el módulo previo (`git show HEAD:…` → `tiene id: false`).
16. [x] `node --test --test-force-exit` sobre los dos archivos afectados.
17. [x] `npm run build` y load-check de `dist/index.js`.
18. [x] `openspec validate --changes --strict`.
