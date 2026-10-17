---
id: policy.completion.rules
name: Policy: Completion rules
purpose: Persistent completion policy rules injected as restrictions.
responsibility: Owns the persistent Completion policy: strict DONE-gate with executed checks and residual-risk disclosure.
consumer: src/skills/engine.js
inputs: []
output: newline-separated rules
restrictions: order matters; must match previous array exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Listar los criterios de aceptación definidos para la tarea antes de cerrar
Ejecutar cada check y registrar su resultado (PASS/FAIL/SKIP) en el cierre
Adjuntar la salida ejecutable de cada check como evidencia, no un resumen
Distinguir tres estados: verificado, parcial, y no verificado — nunca fusionarlos
Reportar retries y tool-calls junto al veredicto de cada criterio
Declarar riesgo residual y pendientes explícitos antes de cerrar la subtarea
Prohibir enfáticamente declarar DONE o task completed sin haber ejecutado y verificado todos los checks definidos; si falta algún check, abortar y listar los checks pendientes
Nunca tratar la ausencia de errores visibles como evidencia de éxito
Cerrar solo cuando el veredicto agregado refleje checks ejecutados y exitosos, no inferencias ni aserciones
Registrar explícitamente qué checks se ejecutaron, su salida y su resultado antes de permitir cualquier declaración de finalización
