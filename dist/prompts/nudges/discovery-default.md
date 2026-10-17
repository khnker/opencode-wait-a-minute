---
id: nudge.discovery.default
name: Discovery nudge: default
purpose: Fallback nudge recommending dedicated tools/CQE MCP.
responsibility: Owns the fallback nudge recommending dedicated tools or the CQE MCP over raw bash discovery.
consumer: src/policy/discovery-classifier.js#nudgeFor
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Consider using dedicated tools (`grep`, `glob`, `read`) or the `context-query-engine` MCP instead of raw bash discovery.
