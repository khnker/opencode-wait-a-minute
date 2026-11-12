---
id: nudge.discovery.default
name: Discovery nudge: default
purpose: Fallback nudge recommending native tools over raw bash file access.
responsibility: Owns the fallback nudge recommending native tools over raw bash file access.
consumer: src/policy/discovery-classifier.js#nudgeFor
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Use native tools (Read, Grep, Glob, Edit/Write) instead of raw bash file access; content-search secondary fallback: tgrep (https://github.com/microsoft/tgrep).
