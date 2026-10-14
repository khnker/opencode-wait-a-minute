---
id: policy.completion.rules
name: Policy: Completion rules
purpose: Persistent completion policy rules injected as restrictions.
responsibility: Owns the persistent Completion policy: distinguish verified from partial work; mark DONE only with executed checks.
consumer: src/skills/engine.js
inputs: []
output: newline-separated rules
restrictions: order matters; must match previous array exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Distinguir trabajo verificado (tests pasan, checks ejecutados) de trabajo parcial
DONE exige evidencia ejecutada, no aserción del agente
Ejecutar los checks definidos en el plan antes de marcar DONE
Registrar riesgo residual y pendientes explícitos al cerrar
Nunca tratar la ausencia de errores visibles como evidencia de éxito
Cerrar una subtarea solo cuando su resultado sea verificable de forma independiente
Reportar latencia y tool-calls como parte del cierre verificable
