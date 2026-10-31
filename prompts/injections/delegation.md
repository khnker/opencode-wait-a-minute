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
[wam delegation] Reqs pendientes → conviene delegar en PARALELO via Task (agente: el apropiado según config del entorno). La mutación directa desde la sesión principal está PERMITIDA: si Task no está disponible o falla, editá/writeá inline. Fallback: reintentar secuencial → tier más barato → inline con evidencia. Nunca abortar en silencio por fallo de delegación.
