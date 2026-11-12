---
id: nudge.discovery.edit
name: Discovery nudge: edit
purpose: Steer agent away from shell in-place edits toward native Edit/Write.
responsibility: Owns the nudge steering sed -i and awk writes toward the native Edit/Write tools.
consumer: src/policy/discovery-classifier.js#nudgeFor
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Use the native Edit/Write tool instead of sed -i or awk writing to files.
