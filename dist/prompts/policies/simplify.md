---
id: policy.simplify.rules
name: Policy: Simplify rules
purpose: Persistent simplify policy rules injected as restrictions.
responsibility: Owns the persistent Simplify policy: identify responsibility, reuse existing abstractions, compare alternatives, minimal change that preserves behavior.
consumer: src/skills/engine.js
inputs: []
output: newline-separated rules
restrictions: order matters; must match previous array exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Identificar la responsabilidad de cada componente y el contrato que debe preservar
Buscar mecanismos, funciones y abstracciones existentes antes de agregar nuevos
Comparar alternativas por comportamiento, acoplamiento, dependencias, mantenibilidad y garantías
Reusar una abstracción cuando sus responsabilidades y condiciones de cambio encajen
No fusionar componentes independientes solo para reducir líneas o duplicación aparente
No agregar abstracción especulativa
Elegir la alternativa más simple que preserve el comportamiento requerido
Verificar consumidores y tests relevantes tras el cambio