---
id: notice.completion_gate
name: Notice: completion gate
purpose: Recommend verification when requirements are still pending.
responsibility: Injects an advisory recommendation on a DONE claim with pending requirements. Never blocks.
consumer: src/integration/message-handler.js
inputs: [count, pendingList, nextAction]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
⚠️ [wait-a-minute] Recomendación: faltan {{count}} requisito(s) sin evidencia.{{pendingList}} Verificá cuando puedas; procedo. Continuar con: {{nextAction}}
