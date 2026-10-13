---
id: nudge.discovery.grep
name: Discovery nudge: grep
purpose: Steer agent away from raw bash search toward grep tool or CQE MCP.
responsibility: Owns the nudge steering search toward the grep tool or CQE MCP.
consumer: src/policy/discovery-classifier.js#nudgeFor
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Consider using the dedicated 'grep' tool or 'context-query-engine' MCP (search_files / context_query) instead of raw bash search.
