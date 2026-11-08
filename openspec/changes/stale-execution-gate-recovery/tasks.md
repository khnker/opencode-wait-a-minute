# Tasks: Stale execution-gate recovery

## Gate ownership

- [x] `src/execution/execution-gate.js`: add `isExecutionGateStale(gate, currentPid)`.
- [x] `index.js` `runTaskAgentPass`: persist `ownerPid: process.pid` with the active gate.
- [x] `index.js` `tool.execute.before`: clear a stale gate before enforcement and continue.

## Tests

- [x] `tests/unit/execution-gate.test.mjs`: cover same-process, other-process, legacy and inactive gates.
- [x] `tests/unit/execution-gate-hook.test.mjs`: mark in-process fixtures with `ownerPid`.
- [x] `tests/unit/execution-gate-hook.test.mjs`: regression test for a gate owned by another process.

## Validation

- [x] `node --test --test-force-exit tests/unit/execution-gate.test.mjs tests/unit/execution-gate-hook.test.mjs tests/unit/execution-gate-pass.test.mjs`
- [x] `openspec validate --changes --strict`
- [x] `npm run build`
- [x] Load-check `dist/`
- [ ] Fresh-session web verification (`npm run verify:web`) — attempted twice: the plugin-loaded run reached 7/11 checks; it timed out waiting for the WAM ANALYST pass to finish in this slow model environment (`gate.active=true`, `agentRun.status=null`), not on the stale-gate path.
