---
id: notice.task_complete
name: Notice: task complete
purpose: Show the final task completion summary once the contract is verified.
responsibility: Emits the visible completion message with objective, verified requirements, evidence and artifacts.
consumer: src/integration/message-handler.js
inputs: [objective, count, evidence, artifacts]
output: multi-line string
restrictions: must match previous literal exactly
verification: tests/unit/task-complete-message.test.mjs
dependencies: []
status: active
---
✅ [wait-a-minute] Tarea completada — contrato verificado
Objetivo: {{objective}}
Requisitos verificados: {{count}}
Evidencia: {{evidence}}
Artefactos: {{artifacts}}
