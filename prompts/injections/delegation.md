---
id: injection.delegation
name: Injection: delegation directive
purpose: Direct agent to delegate pending requirements in parallel via Task.
responsibility: Recommends parallel Task delegation of pending requirements; direct main-session mutation stays allowed (advisory only).
consumer: index.js#delegationLines
inputs: []
output: single-line string
restrictions: advisory wording; must match the characterization fixture
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
[wam delegation] PROPUESTA sin fricción: por defecto, delegá cada req pendiente independiente a un subagente via Task, en paralelo. Contexto justo por subagente: SOLO objetivo del req + dominio/archivos relevantes + criterio de aceptación; nunca el historial completo. No delegues tareas triviales (≤1 edición): resolvelas inline. La sesión principal puede editar/escribir inline sin pedir permiso. Fallback: secuencial → tier más barato → inline con evidencia. Nunca abortar en silencio por fallo de delegación.
