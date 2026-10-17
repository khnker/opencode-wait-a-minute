---
id: nudge.discovery.read
name: Discovery nudge: read
purpose: Steer agent away from raw bash reading toward read tool or CQE MCP.
responsibility: Owns the nudge steering file reading toward the read tool or CQE MCP.
consumer: src/policy/discovery-classifier.js#nudgeFor
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Consider using the dedicated 'read' tool or 'context-query-engine' MCP (read_file) instead of raw bash file reading.
