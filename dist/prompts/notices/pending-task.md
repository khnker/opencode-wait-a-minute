---
id: notice.pending_task
name: Notice: pending task
purpose: Inform a pending task exists and how to resume.
responsibility: Owns the prompt offering to resume an existing pending task.
consumer: src/integration/message-handler.js
inputs: [active, phase]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
[wait-a-minute] {{phase}} Hay una tarea pendiente: {{active}}. ¿Quieres continuarla? Responde /wam resume {{active}} o define una tarea nueva — no asumo intención.
