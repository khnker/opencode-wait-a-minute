# Design: Status prompt classification

## Classification

`isMetaOnlyPrompt` splits on commas and conjunctions. Two additions:

- `META_PHRASE_RE` matches a restart/status clause with a trailing check
  (`reiniciado ve si esta ok`).
- `isMetaOnlyClause` matches a bare restart confirmation (`ya reinicié`) so the
  split clause is meta; `reinicié el servidor` does not match the exact form and
  stays a task.
- `META_PHRASE_RE` also matches status questions (`falta algo`, `qué falta`,
  `algo más`, `qué sigue`, `está listo/completo`, `cómo va`).
- Leading Spanish punctuation (`¿`, `¡`) is stripped before matching, so
  `¿qué falta?` is classified like `qué falta`.

## Effect

Meta prompts return `type: "trivial"` and lane `CONVERSATION`, so
`synthesizeContract` creates no requirements and the completion gate is not
armed.

## Alternatives rejected

- Treating every prompt containing "reinici" as meta: would swallow real restart
  tasks.
- Only patching the lane classifier: `synthesizeContract` would still create the
  requirement.
