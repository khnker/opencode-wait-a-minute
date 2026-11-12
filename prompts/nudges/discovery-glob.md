---
id: nudge.discovery.glob
name: Discovery nudge: glob
purpose: Steer agent away from raw bash listing toward native Glob.
responsibility: Owns the nudge steering file listing toward native Glob.
consumer: src/policy/discovery-classifier.js#nudgeFor
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Use the native Glob tool instead of raw bash find/ls.
