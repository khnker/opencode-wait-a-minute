# Proposal: Treat restart/status checks as conversation

## Why

After a restart, "reiniciado ve si esta ok" was classified as TASK_NEW and
created a contract with requirement "Reiniciado ve si esta ok". The completion
gate then blocked DONE for a message that was only asking for a status check.

## What changes

- Recognize restart and status-check phrases as meta-only conversation:
  `reiniciado ve si esta ok`, `ya reinicié, ve si está ok`, `revisa si funciona`.
- Recognize status questions as conversation: `falta algo ?`, `¿qué falta?`,
  `algo más?`, `¿está listo?`.
- Keep actionable restart requests and actionable gaps as tasks
  (`reinicié el servidor`, `falta implementar el endpoint`).
- Add regression tests for both cases.
