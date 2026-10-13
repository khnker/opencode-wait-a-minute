---
id: injection.decision_gate
name: Injection: decision gate restriction
purpose: Force tracer.logTechnicalDecision before implementing a detected bifurcation.
responsibility: Enforces tracer.logTechnicalDecision before a subagent implements a detected bifurcation.
consumer: src/skills/engine.js
inputs: [label]
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Bifurcación detectada ({{label}}): subagente DEBE invocar tracer.logTechnicalDecision(decisionPoint, rationale, alternatives[], evidence[], technicalMetrics{}) antes de implementar.
