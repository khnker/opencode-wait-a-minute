---
id: policy.verify.rules
name: Policy: Verify rules
purpose: Persistent verify policy rules injected as restrictions.
responsibility: Owns the persistent Verify policy: evidence-driven decision finality; explicit checks, observable results, no invisible success.
consumer: src/skills/engine.js
inputs: []
output: newline-separated rules
restrictions: order matters; must match previous array exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Identificar cada criterio de aceptación obligatorio y la evidencia observable necesaria para satisfacerlo
Asociar cada criterio con un check concreto que produzca evidencia suficiente
Ejecutar los checks pertinentes y registrar su resultado, alcance y limitaciones
Distinguir entre la implementación realizada, el check ejecutado y el resultado verificado
Si un check falla, registrar el fallo y su causa; no declarar satisfecho el criterio
Si un check no puede ejecutarse por una limitación del entorno, registrar el bloqueo sin atribuirlo automáticamente al código ni tratarlo como éxito
No inferir éxito a partir de una afirmación, de la ausencia de errores visibles o de evidencia no relacionada con el criterio
Informar explícitamente los criterios pendientes, las limitaciones y la evidencia que permitiría resolverlos
Explicar claramente por qué NO se puede declarar DONE ni completado mientras no se ejecuten y verifiquen los tests o checks observables requeridos
