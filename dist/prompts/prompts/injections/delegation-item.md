---
id: injection.delegation_item
name: Injection: delegation item
purpose: One pending requirement line for parallel Task delegation.
responsibility: Renders one pending requirement as a parallel Task delegation instruction.
consumer: index.js#delegationLines
inputs: [id, title, hint]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
  {{id}} → Task(parallel) "{{title}}"{{hint}}
