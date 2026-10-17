---
id: injection.backlog_header
name: Injection: backlog header
purpose: Header for out-of-scope backlog report.
responsibility: Owns the opening line reporting how many requirements are parked out of scope.
consumer: src/skills/engine.js#formatBacklog
inputs: [count]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
[wam backlog] {{count}} requerimiento(s) fuera de alcance:
