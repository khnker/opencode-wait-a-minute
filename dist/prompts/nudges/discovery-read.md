---
id: nudge.discovery.read
name: Discovery nudge: read
purpose: Steer agent away from raw bash reading toward native Read.
responsibility: Owns the nudge steering file reading toward native Read.
consumer: src/policy/discovery-classifier.js#nudgeFor
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Use the native Read tool (offset/limit) instead of raw bash cat/head/tail/sed.
