---
id: nudge.runtime.redundant_read
name: Runtime nudge: redundant read
purpose: Warn agent the file was already read unchanged this session.
responsibility: Owns the nudge flagging a re-read of a file unchanged since the last read.
consumer: src/execution/runtime-guards.js
inputs: [path]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
redundant read: {{path}} unchanged since last read in this session
