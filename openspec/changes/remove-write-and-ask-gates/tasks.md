# Tasks: remove-write-and-ask-gates

- [x] Remove `checkToolPath` rejection, `shouldBlockForPendingPermission` throw, execution-gate abort and strict-risk throw from `tool.execute.before`.
- [x] Make `enforceGovernance` advisory even when `contractApproval` is `required`; remove the `requireApproval` block and `shouldBlockForPendingPermission`.
- [x] Delete the now-unused `src/execution/tool-path-guard.js` and its test.
- [x] Mark inferred assumptions/unknowns `advisory` in `src/policy/uncertainty.js` and `src/skills/engine.js`; only explicit `blocking: true` unknowns park `ASKING`.
- [x] Normalize a persisted `ASKING` task with no explicit blocker to `IMPLEMENTING` in the message handler.
- [x] Update regression tests for no-block write tools, advisory unknowns and contract approval.
- [x] Run affected suites with `node --test --test-force-exit <files>`.
- [x] `openspec validate --changes --strict`, `npm run build`, load-check `dist/`.
- [x] Fresh-session web verification: `npm run verify:web -- --out /tmp/wam-web-e2e-remove-write-and-ask-gates`.
