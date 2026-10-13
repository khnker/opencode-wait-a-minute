---
id: injection.simplify_protected
name: Injection: simplify protected
purpose: Prevent Simplify from removing protected constraints.
responsibility: Prevents the Simplify policy from deleting protected constraints during simplification.
consumer: src/skills/engine.js
inputs: [hits]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Protegido por Simplify: NO eliminar {{hits}} — simplificar implementación, no la restricción
