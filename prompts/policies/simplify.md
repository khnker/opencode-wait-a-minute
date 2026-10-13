---
id: policy.simplify.rules
name: Policy: Simplify rules
purpose: Persistent simplify policy rules injected as restrictions.
responsibility: Owns the persistent Simplify policy: YAGNI, reuse existing code, minimal implementation.
consumer: src/skills/engine.js
inputs: []
output: newline-separated rules
restrictions: order matters; must match previous array exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
YAGNI — no construir para necesidades futuras especulativas
Reusar código y abstracciones existentes
Preferir mecanismos nativos y stdlib cuando aplique
Implementación mínima y superficie de cambio mínima
Evitar dependencias innecesarias y generalización prematura
Abstracción solo cuando el requerimiento la exige ahora
