---
id: nudge.discovery.grep
name: Discovery nudge: grep
purpose: Steer agent away from raw bash search toward CQE first (/wam ctx get), grep tool as fallback.
responsibility: Owns the nudge steering search toward CQE first, grep tool as fallback.
consumer: src/policy/discovery-classifier.js#nudgeFor
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Prefer '/wam ctx get "<query>"' (CQE index, fastest) over raw bash search; fallback: dedicated 'grep' tool.
