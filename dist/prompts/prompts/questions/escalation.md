---
id: question.escalation
name: Question: escalated assumption
purpose: Blocking question derived from an assumption statement.
responsibility: Owns the blocking question raised when an assumption needs user confirmation.
consumer: src/skills/engine.js#escalateAssumptions
inputs: [statement]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
¿{{statement}}?
