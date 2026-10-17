---
id: injection.backlog_item
name: Injection: backlog item
purpose: One backlog entry line.
responsibility: Renders a single out-of-scope requirement entry (id + title).
consumer: src/skills/engine.js#formatBacklog
inputs: [id, title]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
  {{id}}: {{title}}
