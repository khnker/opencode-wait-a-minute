---
id: nudge.discovery.grep
name: Discovery nudge: grep
purpose: Steer agent away from raw bash search toward native Grep, with tgrep as secondary.
responsibility: Owns the nudge steering search toward native Grep and tgrep as secondary fallback.
consumer: src/policy/discovery-classifier.js#nudgeFor
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Use the native Grep tool instead of raw bash grep; secondary fallback: tgrep (https://github.com/microsoft/tgrep).
