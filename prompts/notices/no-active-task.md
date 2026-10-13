---
id: notice.no_active_task
name: Notice: no active task
purpose: Ask user to define a new task; no assumed intent.
responsibility: Owns the prompt asking the user to define a task, without assuming intent.
consumer: src/integration/message-handler.js
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
[wait-a-minute] No hay tarea activa. Dime qué tarea nueva quieres — no asumo intención previa.
