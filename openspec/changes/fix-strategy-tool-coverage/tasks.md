# Tasks: Fix strategy tool coverage and orphan execution gates

## Strategy coverage

- [x] `index.js` `approveContract`: add `read`, `glob`, `grep`, `list`,
      `webfetch`, `patch`, `multiedit`, `apply_patch`, `todoread`, `skill`,
      `question` to the default `allowedActions`.
- [x] `index.js` `classifyActionAgainstStrategy`: build the fallback candidate
      with the derived `executable` and `argv`.

## Execution gate

- [x] `src/execution/execution-gate.js`: add `shouldReleaseOrphanGate`.
- [x] `index.js` `tool.execute.before`: release a same-process gate when the
      loop is terminal and no pass is in flight.

## Tests

- [x] `tests/unit/allowed-actions-default.test.mjs`: assert the new tool names.
- [x] `tests/unit/strategy-tool-coverage.test.mjs`: default coverage,
      fail-closed unknown tool, prohibited action, executable/argv binding.
- [x] `tests/unit/execution-gate.test.mjs`: `shouldReleaseOrphanGate` cases.
- [x] `tests/unit/execution-gate-hook.test.mjs`: terminal loop releases the
      gate, running loop keeps blocking.

## Validation

- [ ] `node --test --test-force-exit` on the affected files.
- [ ] `npm run build` and load-check `dist/`.
- [ ] `openspec validate fix-strategy-tool-coverage --strict`.
- [ ] Fresh-session web verification (`npm run verify:web`).
