---
id: nudge.discovery.glob
name: Discovery nudge: glob
purpose: Steer agent away from raw bash listing toward glob tool.
responsibility: Owns the nudge steering file listing toward the glob tool.
consumer: src/policy/discovery-classifier.js#nudgeFor
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Consider using the dedicated 'glob' tool instead of raw bash file listing/finding.
