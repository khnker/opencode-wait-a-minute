# Canonical Project Context (CPC) — Tasks

## Especificación

1. [x] Definir los conceptos canónicos: Proyecto vs Sesión, Hechos Verificados vs Supuestos,
   Presupuesto de Tokens < 150 (design.md).
2. [x] Definir las relaciones entre concepto, sección canónica del memo y resultado del CPC.

## Implementación

3. [x] `src/context/canonical-project-context.js`: `buildCanonicalProjectContext`.
4. [x] `src/context/canonical-project-context.js`: `renderCanonicalProjectContext`.
5. [x] `src/context/canonical-project-context.js`: `validateCanonicalProjectContext`
   (presupuesto + contaminación de sesión).
6. [x] `src/context/canonical-project-context.js`: `prepareCanonicalProjectContext`
   (build + render + validate en una llamada).
7. [x] `src/context/canonical-project-context.js`: `loadCanonicalProjectContext` (memo canónico).
8. [x] `src/context/canonical-project-context.js`: `injectCanonicalProjectContext`
   (inyección idempotente al iniciar tarea).
9. [x] `index.js`: inyectar el CPC en el hook `chat.message` cuando hay tarea activa
   (enganchado al promise del handler, sin `await`, para no alterar el orden de las partes).
10. [x] `docs/architecture/context-packs.md`: documentar el mecanismo CPC y su side effect.

## Pruebas

11. [x] Test suite `src/context/canonical-project-context.test.mjs`:
    - clasificación hecho/supuesto por sección;
    - rechazo de secciones de sesión y de marcadores de sesión;
    - límite de tokens (< 150) con memo sobredimensionado;
    - degradación: primero se descartan los supuestos, luego los hechos menos canónicos;
    - rótulos distintos para hechos y supuestos;
    - validación de un CPC fuera de presupuesto;
    - inyección al iniciar tarea + idempotencia + parte sintética WAM;
    - no inyección sin tarea activa.
12. [x] Verificación end-to-end del seam: el bloque `[wam CPC]` llega al output del hook
    `chat.message` con hechos y supuestos rotulados (script de verificación manual).

## Verificación

13. [x] `node --test src/context/canonical-project-context.test.mjs` → 9/9 ✔
14. [x] `node --test src/context/canonical-project-context.test.mjs src/context/assembly.test.mjs
    src/context/context-cache.test.mjs` → 20/20 ✔
15. [x] `node --test test/message-handler.test.mjs test/message-handler-idempotency.test.mjs
    test/session-identity.test.mjs src/context/*.test.mjs` → 71/72 (el fallo es
    `src/context/design-context.test.mjs`: export `detectDesignDrift` ausente en
    `src/context/design-context.js`, root-owned — preexistente y ajeno a este change).
16. [x] `openspec validate add-canonical-project-context --strict` → válido ✔
    (`openspec validate --changes`: 69/70 changes; el único fallo es
    `task-conditioned-role-replacement`, preexistente y ajeno).
17. [x] `tests/unit/plugin-load.test.mjs`: sin regresiones atribuibles a este change — los mismos
    6 fallos aparecen con y sin el CPC (verificado revirtiendo solo los edits del CPC sobre
    `index.js`); son consecuencia del trabajo sin commitear previo en el working tree.
18. [x] Auditoría de seguridad del cambio (design.md → Seguridad): superficie de prompt injection
    acotada por el presupuesto, lectura única dentro del wam root, sin escritura/red/shell,
    idempotencia, inyección best-effort y rechazo de datos de sesión.
19. [ ] Suite completa (`npm test`) antes de archivar: el working tree tiene fallos preexistentes
    por trabajo sin commitear (no atribuibles a este change).
