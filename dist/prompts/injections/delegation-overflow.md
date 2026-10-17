---
id: injection.delegation_overflow
name: Injection: delegation overflow
purpose: Report consolidated additional requirements.
responsibility: Owns disclosure of consolidated requirements not listed individually.
consumer: index.js#delegationLines
inputs: [count]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
  ...(+{{count}} requisitos adicionales consolidados)
