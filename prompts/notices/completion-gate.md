---
id: notice.completion_gate
name: Notice: completion gate
purpose: Block DONE claim when requirements are pending.
responsibility: Owns the hard block forbidding a DONE claim while requirements remain pending.
consumer: src/integration/message-handler.js
inputs: [count, pendingList, nextAction]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
⛔ [wait-a-minute] COMPLETION GATE: faltan {{count}} requisito(s). No declare DONE.{{pendingList}} Continuar con: {{nextAction}}
