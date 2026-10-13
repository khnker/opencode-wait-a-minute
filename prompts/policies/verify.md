---
id: policy.verify.rules
name: Policy: Verify rules
purpose: Persistent verify policy rules injected as restrictions.
responsibility: Owns the persistent Verify policy: no task is DONE without satisfied evidence.
consumer: src/skills/engine.js
inputs: []
output: newline-separated rules
restrictions: order matters; must match previous array exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Toda implementación debe tener resultado verificable
Ninguna tarea se marca DONE sin evidencia satisfecha
Ejecutar tests/lint/typecheck de los artefactos tocados
Verificar consumidores de los cambios, no solo el cambio
