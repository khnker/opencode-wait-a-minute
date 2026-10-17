---
id: injection.delegation
name: Injection: delegation directive
purpose: Direct agent to delegate pending requirements in parallel via Task.
responsibility: Enforces parallel Task delegation of pending requirements and blocks main-session file mutation.
consumer: index.js#delegationLines
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
[wam delegation] Reqs pendientes → delegar en PARALELO via Task (agente: el apropiado según config del entorno). Mutación directa de archivos desde la sesión principal está BLOQUEADA — solo un subagente ejecuta write/edit.
