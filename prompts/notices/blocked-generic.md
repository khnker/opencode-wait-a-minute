---
id: notice.blocked_generic
name: Notice: blocked (generic)
purpose: Block when there are unanswered questions.
responsibility: Owns the generic block notice when questions are unanswered.
consumer: src/integration/message-handler.js
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
⛔ [wait-a-minute] BLOQUEADO: Tienes preguntas sin responder.
