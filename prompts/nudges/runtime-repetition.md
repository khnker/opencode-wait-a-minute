---
id: warning.runtime.repetition
name: Runtime warning: repetition
purpose: Warn repeated action detected; consider replanning.
responsibility: Owns the warning that a repeated failing action should trigger replanning.
consumer: src/execution/runtime-guards.js
inputs: [status]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Repetición detectada: ya se intentó {{status}}. Considera replanificar.
