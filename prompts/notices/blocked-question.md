---
id: notice.blocked_question
name: Notice: blocked (question)
purpose: Block implementation until a specific question is answered.
responsibility: Owns the block notice halting implementation until a specific question is answered.
consumer: src/integration/message-handler.js
inputs: [id, question]
output: two-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
⛔ [wait-a-minute] BLOQUEADO: Pregunta pendiente — {{id}}: {{question}}
Responder: /wam answer {{id}} <respuesta>
