---
id: nudge.discovery.glob
name: Discovery nudge: glob
purpose: Steer agent away from raw bash listing toward CQE first (/wam ctx get), glob tool as fallback.
responsibility: Owns the nudge steering file listing toward CQE first, glob tool as fallback.
consumer: src/policy/discovery-classifier.js#nudgeFor
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Prefer '/wam ctx get "<query>"' (CQE index, fastest) over raw bash file listing/finding; fallback: dedicated 'glob' tool.
