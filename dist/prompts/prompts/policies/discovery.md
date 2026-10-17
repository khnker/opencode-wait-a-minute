---
id: policy.discovery.rules
name: Policy: Discovery rules
purpose: Persistent discovery policy rules injected as restrictions.
responsibility: Owns the persistent Discovery policy: gather context before acting and prefer indexed lookups.
consumer: src/skills/engine.js
inputs: []
output: newline-separated rules
restrictions: order matters; must match previous array exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
Recopilar contexto antes de escribir código — buscar, leer y mapear primero
Preferir búsquedas indexadas (tgrep, grep, glob) sobre barridos exhaustivos
Inspeccionar archivos vecinos para reutilizar interfaces y DTOs
Evitar reimplementar lógica que ya existe en el codebase
Escalar a exploración multi-ángulo solo cuando el objetivo no es claro
Usar el MCP `context-query-engine` para lookups read-only con objetivo acotado
Pedir aclaración al usuario solo cuando el requerimiento sea genuinamente ambiguo
