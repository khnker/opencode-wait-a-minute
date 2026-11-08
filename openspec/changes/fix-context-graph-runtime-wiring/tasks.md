## 1. Runtime input loading

- [x] 1.1 Add `src/context/runtime-context-inputs.js` with bounded loaders.
- [x] 1.2 Normalize run decisions, observations, actions, evidence, and
  cognition entries.
- [x] 1.3 Wire the loader into `src/integration/message-handler.js`.

## 2. Graph reconstruction

- [x] 2.1 Map `runState.actions`, `runState.observations`, and
  `runState.decisions` in `src/context/context-graph-builder.js`.
- [x] 2.2 Preserve requirement status and verification in node metadata.

## 3. Router closure

- [x] 3.1 Add per-requirement support collection in
  `src/context/context-router.js`.
- [x] 3.2 Prefer valid evidence and enforce deterministic caps.

## 4. Tests

- [x] 4.1 Add loader tests for bounds and normalization.
- [x] 4.2 Add builder tests for run-state mapping.
- [x] 4.3 Add router tests for requirement evidence without prompt matches.
- [x] 4.4 Add assembly test proving evidence reaches N3.

## 5. Validation

- [x] 5.1 Run targeted tests.
- [x] 5.2 Run `openspec validate --changes --strict`.
- [x] 5.3 Run `npm run build` and load-check `dist/`.
