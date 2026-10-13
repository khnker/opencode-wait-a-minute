---
id: injection.continuation
name: Injection: continuation header
purpose: Announce rebuilt context on continuation.
responsibility: Signals that context was rebuilt on a continuation and names the changed signals.
consumer: src/integration/message-handler.js
inputs: [signals]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
[wam continuation] Contexto reconstruido ({{signals}})
