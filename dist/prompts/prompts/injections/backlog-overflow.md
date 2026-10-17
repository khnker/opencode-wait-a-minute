---
id: injection.backlog_overflow
name: Injection: backlog overflow
purpose: Report additional backlog entries beyond the visible cap.
responsibility: Owns disclosure of backlog entries hidden beyond the visible cap.
consumer: src/skills/engine.js#formatBacklog
inputs: [count]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
  ...(+{{count}} más)
