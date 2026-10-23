# Canonical Project Context (CPC)

## Why

WAM ya inyecta contexto por niveles (N0 policy, N1 project, N2 task, N3 session), pero el
"contexto de proyecto" actual es un resumen libre: sin límites de tokens, sin separación entre
hecho verificado y supuesto, y sin una frontera explícita contra el contenido de sesión.

Consecuencias observadas en este repo:

- El memo de decisiones del proyecto ya tiene 48 entradas y el de cambios recientes 1840
  secciones: sin un presupuesto duro, el bloque de proyecto puede crecer sin techo.
- `project.md` mezcla secciones observadas (`Stack (observed)`) con inferidas (`Inferred`) y
  asumidas (`Assumed`) en el mismo plano textual: el agente no puede distinguir un hecho
  canónico de una conjetura.
- Nada impide que un dato de sesión (task id, transcript, cambios recientes) termine dentro del
  contexto que el agente toma como canónico del proyecto.

El CPC define un bloque de grounding del proyecto: **hechos verificados** y **supuestos**
separados, **presupuesto duro < 150 tokens**, y **cero datos de sesión**.

## What Changes

- Define los conceptos canónicos del CPC y sus relaciones:
  - **Proyecto vs Sesión** — el CPC solo admite contenido de proyecto; el contenido de sesión
    se rechaza en la frontera (sección no canónica o marcador de sesión en la línea).
  - **Hechos Verificados vs Supuestos** — cada statement se clasifica por su sección de
    origen y se renderiza con prefijo distinto (`[wam CPC fact]` / `[wam CPC assumption]`).
  - **Presupuesto de Tokens < 150** — el bloque renderizado debe medir menos de 150 tokens;
    bajo presión se descartan primero los supuestos y, solo si no alcanza, los hechos menos
    canónicos; el último hecho se trunca antes de exceder el límite.
- Nuevo módulo `src/context/canonical-project-context.js` con la interfaz de construcción,
  render, validación e inyección del CPC.
- El CPC se inyecta al iniciar tareas, como parte sintética trazable en el hook `chat.message`
  (solo cuando la sesión tiene tarea activa; idempotente).
- Test suite (`src/context/canonical-project-context.test.mjs`) que valida el límite de tokens,
  el contenido canónico del proyecto y la ausencia de datos de sesión.

## Non-Goals

- No reemplaza N0–N3 ni el context pack: el CPC es un bloque complementario y acotado.
- No cambia el modelo de memoria operacional (`.wam/context/*`) ni su persistencia.
- No inventa hechos: solo clasifica y presupuesta lo que ya está en el memo canónico.
- No verifica supuestos (no los convierte en hechos): los rotula y los degrada bajo presión
  de presupuesto.
- No toca el formato del memo `project.md`: el CPC lo lee, no lo reescribe.
