# Contrato de parts sintéticos (part-provenance)

## Why

El plugin inyecta partes sintéticas en la salida del hook `chat.message`. OpenCode 1.19.4 valida
esas partes antes de persistirlas y exige un `id` con formato `prt_`. Cuando falta, rechaza el
mensaje completo y el prompt muere antes de arrancar el loop del modelo:

```text
ERROR invalid user part before save  partID=undefined partType=text part.metadata.wamPhase=cpc
      cause="SchemaError: Missing key at [\"id\"]"
ERROR prompt_async failed  cause=Die(SchemaError(Missing key at [\"part\"][\"id\"]))
```

Estado observado en producción (log local, 2026-10-30T23:11Z → 2026-10-31T01:28Z): **31 fallos en
~20 sesiones**, todos `wamPhase=cpc`, todos `partID=undefined`. Síntoma para el usuario: la sesión
no avanza, el mensaje queda guardado y no hay respuesta.

La causa no es un call site aislado: el contrato de la parte vivía implícito en la cabeza de cada
llamador. `tagWamPart` sólo asignaba `id` si el llamador pasaba `idFactory`, de modo que cualquier
sitio nuevo podía emitir una parte inválida sin que nada lo detectara. `index.js` ya documentaba la
invariante desde 1.18.25, pero el módulo que construye las partes no la hacía cumplir.

## What Changes

- `src/integration/part-provenance.js` pasa a ser la **frontera única** del contrato: toda parte
  que sale del módulo tiene `id` único, o es descartada con warning.
- El `id` deja de ser opcional: `tagWamPart` usa `defaultPartId()` (CSPRNG, `prt_` + 16 hex) cuando
  el llamador no provee uno; los ids del llamador se preservan si son válidos.
- Nuevo `validateWamPart(part)` que codifica los requisitos de OpenCode 1.19.4 y es reutilizable
  por tests y por otros adaptadores.
- `injectWamParts` devuelve `{ inserted, dropped }`, evita colisiones de id contra el sink y nunca
  lanza: una parte corrupta degrada la inyección, no la sesión.
- `injectCanonicalProjectContext` propaga `idFactory` (defensa en profundidad) y `index.js` pasa
  `genPartId`, ahora alias del generador único.
- Tests de regresión que fallan con el código previo + extensión del test de schema 1.19 existente.

## Non-Goals

- No cambia el contenido, el orden ni la idempotencia de las inyecciones existentes.
- No define un esquema completo de todos los tipos de parte de OpenCode: cubre la invariante que
  hoy rompe sesiones (identidad y forma mínima de una parte de texto persistida).
- No introduce reintentos ni recuperación de prompts ya rechazados: el fix es preventivo.
- No toca `buildAutoLoopPrompt`: sus partes viajan como input de `session.prompt` (el servidor
  genera el id), no como salida de hook persistida.
