---
id: notice.question_answered
name: Notice: question answered
purpose: Confirm a blocking question was resolved.
responsibility: Owns the confirmation that a blocking question was resolved so flow may proceed.
consumer: src/integration/message-handler.js
inputs: [id, answer, question]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
[wait-a-minute] question answered — {{id}}: {{answer}}. Ready → Proceed ({{question}})
