---
id: notice.blocked_prefix
name: Notice: blocked rewrite prefix
purpose: Rewrite the implementation prompt so it is not consumed as an answer.
responsibility: Owns the rewritten prompt that stops an implementation attempt from being consumed as an answer.
consumer: src/integration/message-handler.js
inputs: [directive]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
[wait-a-minute] BLOQUEADO — prompt de implementación no consumido como respuesta. {{directive}}
