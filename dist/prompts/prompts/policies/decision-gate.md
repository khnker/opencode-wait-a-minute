---
id: policy.decision-gate.rules
name: Policy: Decision-gate rules
purpose: Persistent decision-gate policy rules injected as restrictions.
responsibility: Owns the persistent Decision-gate policy: every detected bifurcation requires a logged technical decision before implementation.
consumer: src/skills/engine.js
inputs: []
output: newline-separated rules
restrictions: order matters; must match previous array exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Ante una bifurcación detectada, invocar tracer.logTechnicalDecision antes de implementar
Declarar decisionPoint, rationale, alternatives[], evidence[] y technicalMetrics{}
Considerar al menos dos alternativas antes de elegir
Justificar cada alternativa rechazada con su motivo explícito
Adjuntar evidencia verificable (benchmark, link, lectura) por alternativa
No implementar hasta que la decisión esté registrada y referenciada
Escalar al orquestador cuando la bifurcación supere el alcance del subagente
