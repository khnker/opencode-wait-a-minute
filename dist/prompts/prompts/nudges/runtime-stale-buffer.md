---
id: reason.runtime.stale_buffer
name: Runtime reason: stale buffer
purpose: Block edit when file changed since last read.
responsibility: Owns the reason returned when an edit targets a file changed since last read.
consumer: src/execution/runtime-guards.js
inputs: [path]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
stale buffer: {{path}} changed since last read; re-read the file before editing
