---
id: injection.n2_task
name: Injection: N2 task header
purpose: Header + live context injected for a continuation fast-path.
responsibility: Frames the N2 live task delta injected into the agent.
consumer: src/integration/message-handler.js
inputs: [live]
output: string (trailing newline composed by caller)
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
[wam N2 task]
{{live}}
