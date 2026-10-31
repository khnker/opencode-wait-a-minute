# Contrato de parts sintéticos — Design

## Problema

OpenCode valida la salida del hook `chat.message` como un mensaje de usuario completo. Una parte
de texto persistida necesita, entre otros campos, `id`. Si falta, el guardado falla y con él el
`prompt_async` completo: no hay turno del asistente, la sesión queda colgada sin error visible.

Grafo del fallo (verificado en log y en código):

| Paso | Evidencia |
|---|---|
| `index.js:1276` inyecta CPC en fase PROPOSED | `state?.phase === "PROPOSED"` |
| `injectCanonicalProjectContext` → `injectWamParts` sin `idFactory` | `canonical-project-context.js:365` (previo) |
| `tagWamPart` sólo asigna `id` si recibe `idFactory` | `part-provenance.js:29` (previo) |
| OpenCode rechaza la parte | `invalid user part before save … Missing key at ["id"]` |
| El prompt no arranca | `prompt_async failed … Die(SchemaError(Missing key at ["part"]["id"]))` |

Causa raíz: el contrato era **implícito y opcional**. Cada llamador debía recordar un argumento;
el módulo dueño de la construcción no podía garantizar nada.

## Invariante

> Toda parte que WAM entrega a OpenCode cumple el contrato de parte de usuario; si no puede
> cumplirlo, no se entrega.

La invariante se hace total en la frontera (`part-provenance.js`) y se verifica con el mismo
predicado que usan los tests (`validateWamPart`), no con convenciones dispersas.

## Alternativas consideradas

| Opción | Descripción | Veredicto |
|---|---|---|
| **A. Parche por call site** | Pasar `idFactory` en `canonical-project-context.js:365` | Rechazada: arregla el síntoma de hoy; el próximo sitio nuevo vuelve a romper. El bug ya existía pese a que otro sitio pasaba id. |
| **B. Función total en la frontera** | `tagWamPart` genera id por defecto; `injectWamParts` valida, deduplica y descarta; generador único exportado | **Elegida**: imposible emitir una parte inválida desde ningún llamador; el contrato vive en un solo lugar y es testeable sin red. |
| **C. Validador de esquema completo en el hook** | Portar el schema de OpenCode y validar todo el output antes de devolverlo | Rechazada como única solución: acopla el plugin a una versión del esquema y no evita el descarte; se adopta su parte útil (predicado `validateWamPart`) sin duplicar el schema. |

## Interfaz del módulo

`src/integration/part-provenance.js`:

| Export | Propósito |
|---|---|
| `PART_ID_PREFIX` | prefijo `prt_` del contrato |
| `defaultPartId()` | id `prt_` + 16 hex desde `crypto.randomBytes` |
| `tagWamPart(part, opts)` | normaliza (string u objeto) y garantiza `id`, `type`, `sessionID`, `messageID`, `synthetic`, `metadata` |
| `validateWamPart(part)` | predicado puro `{valid, errors}` con los requisitos de OpenCode 1.19.4 |
| `injectWamParts(target, parts, opts)` | resuelve sink, deduplica ids, descarta inválidos, devuelve `{inserted, dropped}` |
| `isWamSynthetic`, `hasWamMarkerFor`, `resolveInjectionSink` | sin cambios de contrato |

## Decisiones

1. **Id por defecto, no opt-in.** `idFactory` sigue aceptándose por compatibilidad, pero el default
   es `defaultPartId`. Ningún llamador puede olvidarlo.
2. **Fallar suave en la inyección, ruidoso en el diagnóstico.** Una parte inválida se descarta y se
   reporta con `console.warn` (el resto del prompt sobrevive). Coherente con la regla del repo
   «fail loud on corrupt state, fail soft on diagnostics».
3. **Prefijo validado según OpenCode, no inventado.** El binario 1.19.4 define `PartID` como
   `o.check(qc("prt"))` con `qc(e)` = «string que empieza con `e`» (evidencia:
   `opencode-linux-x64/bin/opencode`, `function qc(e,t){…r.startsWith(e)…}`). El validador exige
   prefijo `prt`; la generación usa la convención `prt_` + 16 hex. Esto destapó un segundo caso
   latente: `tests/unit/skill-pipeline.integration.test.mjs` inyectaba `wam-skill-part-1`, un id que
   OpenCode también habría rechazado; el test se corrigió a un id conforme.
4. **Un solo generador.** `index.js` deja de tener su propio `genPartId` (Math.random) y usa
   `defaultPartId` (CSPRNG). Los usos existentes (`index.js:191`, `index.js:1207`,
   `message-handler.js:789`) quedan apuntando al mismo generador.
5. **Deduplicación contra el sink.** Si el id ya existe en las partes presentes, se regenera: dos
   partes con el mismo id también rompen la persistencia.
6. **`buildAutoLoopPrompt` fuera de alcance.** Sus partes son input de `session.prompt`
   (`index.js:999`), donde el servidor asigna la identidad; no pasan por el guardado que falló.

## Verificación

- `tests/unit/part-provenance-contract.test.mjs`: forma del id, preservación de ids del llamador,
  colisión, descarte sin excepción, no mutación, shape anidado y **la llamada exacta del CPC**.
- `tests/unit/completion-gate-validation.test.mjs`: el test de schema 1.19 ahora exige `id`.
- Evidencia de regresión: `git show HEAD:src/integration/part-provenance.js` inyectado con la misma
  llamada CPC produce una parte sin `id` (`tiene id: false`), que es lo que el test nuevo prohíbe.

## Riesgos residuales

- Si OpenCode endurece el esquema (p. ej. exigir más campos en tipos no-texto), `validateWamPart`
  debe extenderse; está aislado para que ese cambio sea de una función.
- Las sesiones ya rechazadas no se recuperan solas: hay que reenviar el prompt tras reiniciar el
  servidor para que cargue el plugin corregido.
