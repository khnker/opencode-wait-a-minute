# Canonical Project Context (CPC) — Design

## Conceptos

| Concepto | Definición | Dónde vive |
|---|---|---|
| **Proyecto** | Memoria estable del repo: identidad, stack, decisiones, constraints, convenciones. Sobrevive entre sesiones. | `.wam/context/project.md` (memo canónico) |
| **Sesión** | Estado efímero de la conversación: task state, transcript, capsules, N2/N3, cambios recientes. | `.wam/tasks/*`, `.wam/sessions.log.jsonl`, contexto N2/N3 |
| **Hecho verificado** | Statement observado o confirmado del proyecto. Secciones: `Stack (observed)`, `Facts`, `Decisions`, `Constraints`, `Architecture`, `Conventions`. | Secciones canónicas del memo |
| **Supuesto** | Statement inferido o asumido. Secciones: `Inferred`, `Assumed`, `Open Questions`, `Hypotheses`, `Provisional`. | Secciones canónicas del memo |
| **CPC** | Bloque de grounding canónico del proyecto renderizado e inyectado al iniciar tareas. | `src/context/canonical-project-context.js` |

## Relaciones

```
Proyecto (canónico, estable)
  └── memo project.md ──► CPC ──► bloque inyectado (< 150 tokens)
        │                  ▲
        │                  └── hechos verificados / supuestos (separados y rotulados)
        └── secciones de sesión → RECHAZADAS en la frontera

Sesión (efímera)
  └── task state / transcript / capsules / N2 / N3 ──► NUNCA entran al CPC
```

Reglas de la relación:

1. El CPC se construye **solo** desde el memo canónico del proyecto.
2. Una sección de sesión (`Session`, `Task`, `Recent`, `Transcript`, `History`, `Runtime`,
   `Capsule`, `Chat`) y una línea con marcador de sesión (`sessionId`, `taskId`, `task state`,
   `[wam N2`, `[wam N3`, `session.log`, `transcript`) se rechazan y se registran en `rejected`.
3. Una sección desconocida también se rechaza: el CPC no inventa categorías.
4. El CPC no escribe ni muta el memo: es una vista de lectura, acotada en tokens.

## Presupuesto de tokens

- Límite duro: `CPC_TOKEN_BUDGET = 150`; el bloque renderizado MUST medir `< 150` tokens.
- Medición: `countTokens` de `src/context/tokenizer.js` (misma heurística BPE que usa el resto
  del runtime para budgets).
- Orden de degradación (determinista, sin perder prioridad):
  1. se descartan los supuestos, **de atrás hacia adelante** (el último es el menos canónico);
  2. se descartan los hechos menos canónicos (los últimos), conservando los primeros enteros;
  3. si queda un solo hecho y sigue excediendo, se trunca por palabras (`…`);
  4. nunca se excede el límite: si aun así se excede, `validateCanonicalProjectContext`
     devuelve `valid: false` y el CPC no se inyecta.
- El contenido descartado queda registrado en `dropped` (trazabilidad, no reinyección).

## Interfaz del módulo

`src/context/canonical-project-context.js` (superficie única, del lado del llamador):

| Export | Propósito |
|---|---|
| `CPC_TOKEN_BUDGET` | límite duro (150) |
| `CPC_MARKER` | marcador del bloque + clave de idempotencia |
| `buildCanonicalProjectContext({ doc, source })` | parsea + presupuesta → objeto CPC |
| `renderCanonicalProjectContext(cpc)` | renderiza el bloque inyectable |
| `validateCanonicalProjectContext(cpc)` | presupuesto + contaminación de sesión + tipos |
| `prepareCanonicalProjectContext({ doc, source })` | build + render + validate en una llamada |
| `loadCanonicalProjectContext(root)` | lee el memo canónico del wam root |
| `injectCanonicalProjectContext(output, { root, taskId, messageID })` | inyecta al iniciar tarea (idempotente) |

Render (estable, una línea por statement):

```
[wam CPC] canonical project context
[wam CPC fact] Proyecto wait-a-minute-plugin (opencode-wait-a-minute)
[wam CPC assumption] El usuario escribe en español
```

## Seam de inyección

La inyección vive en el hook `chat.message` de `index.js`, enganchada al promise que devuelve
`handleMessage` **sin `await`** (para no alterar la resolución del hook ni el orden de las
partes ya inyectadas):

```js
const pending = handleMessage(input, output, { ... });
Promise.resolve(pending).then(() => {
  const taskId = sessionTasks.get(input?.sessionID);
  const root = sessionWamRoots.get(input?.sessionID);
  if (taskId && root) injectCanonicalProjectContext(output, { root, taskId, messageID });
});
return pending;
```

- solo cuando la sesión tiene tarea activa (`sessionTasks`) y el root ya está resuelto
  (`sessionWamRoots`, poblado por `ensureWamMemory` dentro del handler);
- el bloque se emite como parte sintética WAM (`injectWamParts`, `metadata.wam === true`), con la
  misma trazabilidad que el resto del contexto inyectado;
- es idempotente: si el marcador `[wam CPC]` ya está en la salida, no se duplica;
- nunca lanza: un fallo de inyección no puede tumbar el hook.

### Por qué no dentro de `assembleContext`

`src/context/assembly.js` y `src/integration/message-handler.js` son **root-owned** (modo 644,
owner root) en este workspace: no son escribibles sin `sudo`, y el proyecto no permite sudo sin
password. Meter el CPC en el context pack exigiría tocar esos archivos, así que el seam elegido
es el hook (`index.js`, escribible), que es donde "arranca una tarea" para el usuario. La
consecuencia asumida: el CPC es una parte sintética propia, no una línea N1 del pack.

## Seguridad

| Superficie | Evaluación | Mitigación |
|---|---|---|
| Contenido inyectado en el prompt | El memo `.wam/context/project.md` entra al prompt del agente (superficie de prompt injection local) | presupuesto duro (< 150 tokens), solo bullets de secciones canónicas, rechazo de marcadores de sesión, sin secretos (el memo no guarda tokens ni credenciales) |
| Lectura fuera del proyecto | El módulo lee solo `<root>/.wam/context/project.md` | raíz ya resuelta por el runtime (`sessionWamRoots`); sin escritura, sin red, sin shell |
| Duplicación / growth | Inyección repetida podría hacer crecer el prompt | idempotencia por marcador `[wam CPC]` |
| Fallo de inyección | Excepción en el hook rompería el turno | `try/catch` + `.catch(() => {})`: la inyección es best-effort |
| Fuga de datos de sesión | Task id, transcript o N2/N3 en el bloque canónico | rechazo en build (`rejected`) y revalidación del render (`validateCanonicalProjectContext`) |

## Decisiones

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Fuente canónica = memo `project.md` existente | crear un `PROJECT_CONTEXT.md` nuevo | anti-reimplementación: el memo ya es la memoria de proyecto y separa `observed` / `Inferred` / `Assumed` |
| Presupuesto por tokens con `countTokens` | límite por caracteres | mismo tokenizador que el resto del runtime |
| Degradar supuestos → hechos → truncar | truncar siempre | preserva el contenido canónico más antiguo y menos discutible |
| Rechazar secciones desconocidas | aceptarlas como hechos | el CPC no debe inventar categorías canónicas |
| Inyección en el hook | en `assembleContext` | archivos root-owned; el hook es el seam escribible equivalente |
| Bloque sintético separado | reescribir la parte de texto del usuario | no altera el mensaje del usuario ni el texto ya inyectado |

## Riesgos

- El memo de proyecto puede estar ausente en un repo recién clonado (`.wam/` está gitignored):
  en ese caso el CPC no se inyecta (sin error, sin líneas vacías).
- El CPC hereda la calidad del memo: si el memo está vacío o sesgado, el CPC lo refleja.
- `project.md` puede crecer sin control; el CPC lo acota, pero el memo sigue sin depurarse.
