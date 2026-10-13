---
id: notice.similar_task
name: Notice: similar task
purpose: Report a similar existing task (candidate only).
responsibility: Owns the advisory that a similar task exists (candidate only, not an action).
consumer: src/integration/message-handler.js
inputs: [taskId]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
[wait-a-minute] Tarea similar detectada: {{taskId}} (usa /wam task switch {{taskId}} para retomar)
