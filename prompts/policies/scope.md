---
id: policy.scope.rules
name: Policy: Scope rules
purpose: Persistent scope policy rules injected as restrictions.
responsibility: Owns the persistent Scope policy: deliver only what was asked with minimal change surface.
consumer: src/skills/engine.js
inputs: []
output: newline-separated rules
restrictions: order matters; must match previous array exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Entregar únicamente lo pedido — sin expansión de alcance
No agregar features no solicitadas
No refactorizar código ajeno a la tarea
Cambiar la mínima superficie posible
