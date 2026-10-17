---
id: warning.contradiction.unresolved
name: Warning: unresolved contradictions
purpose: Report unresolved conflicts in context.
responsibility: Owns the warning flagging unresolved context conflicts and forbidding silent resolution.
consumer: src/verification/contradiction-resolution.js
inputs: [count]
output: list-item string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
  ⚠ {{count}} unresolved conflict(s) — do not choose silently
