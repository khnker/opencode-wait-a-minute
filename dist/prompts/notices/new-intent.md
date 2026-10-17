---
id: notice.new_intent
name: Notice: new intent
purpose: Announce a new task is being opened.
responsibility: Owns the announcement that a new task is being opened.
consumer: src/integration/message-handler.js
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
[wait-a-minute] Nueva intención detectada. Abriendo tarea nueva.
