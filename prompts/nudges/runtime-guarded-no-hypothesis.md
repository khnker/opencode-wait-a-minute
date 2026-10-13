---
id: warning.runtime.guarded_no_hypothesis
name: Runtime warning: guarded without hypothesis
purpose: Warn GUARDED action lacks hypothesisId.
responsibility: Owns the warning that a GUARDED action lacks a hypothesisId before mutation.
consumer: src/execution/runtime-guards.js
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
GUARDED action without hypothesisId — attach hypothesis before mutating.
