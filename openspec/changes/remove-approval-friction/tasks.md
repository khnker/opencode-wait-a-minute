# Tasks: remove-approval-friction

- [x] Auto-grant derived permission plans in `ensurePermissionPlan`; upgrade persisted
      `pending` plans; preserve `denied`.
- [x] Stop emitting the contract-proposal recommendation from the message handler.
- [x] Update `src/policy/permission-preflight.test.mjs` and add a regression asserting
      auto-granted plans produce no advisory lines.
- [x] Update `test/permission-preflight-adapter.test.mjs` to expect a granted plan and
      no `PERMISOS SUGERIDOS` advisory.
- [x] Run `node --test --test-force-exit src/policy/permission-preflight.test.mjs src/policy/zero-friction.test.mjs`.
- [x] `openspec validate remove-approval-friction --strict`.
- [x] `npm run build`.
- [x] Fresh-session web verification:
      `npm run verify:web -- --out /tmp/wam-web-e2e-remove-approval-friction`
      (PASS, 11/11 checks; report at `/tmp/wam-web-e2e-remove-approval-friction/report.md`).
