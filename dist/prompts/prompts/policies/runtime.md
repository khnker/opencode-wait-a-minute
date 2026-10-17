---
id: policy.runtime.rules
name: Policy: Runtime rules
purpose: Persistent runtime policy rules injected as restrictions.
responsibility: Owns the persistent Runtime policy: operate within latency, token and tool-call budgets; never silently retry without escalation.
consumer: src/skills/engine.js
inputs: []
output: newline-separated rules
restrictions: order matters; must match previous array exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Operar dentro de los presupuestos declarados de latencia, tokens y tool-calls
Medir latencia incluso ante errores y reportar el peor caso observado
Evitar retries silenciosos — distinguir reintento legítimo de loop
Respetar el budget de tool-calls: una métrica más por encima del umbral debe escalar
Reportar retries como señal explícita, no como éxito
No inflar el contexto: preferir resúmenes sobre volcados completos
Cerrar el ciclo emitiendo una métrica verificable por cada acción ejecutada
