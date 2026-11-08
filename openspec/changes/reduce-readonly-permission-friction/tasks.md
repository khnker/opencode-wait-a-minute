# Tasks: reduce-readonly-permission-friction

## 1. One-shot advisory

- [x] Extract `shouldNotifyPermissionPlan(state, plan)` in `src/policy/permission-preflight.js`.
- [x] Gate the `PERMISOS SUGERIDOS` injection in `src/integration/message-handler.js`
      on that helper so it is emitted at most once per task.
- [x] Classify top-level `sed`/`echo` as read-only in `src/policy/discovery-classifier.js`
      (mutating `sed -i` and redirects stay justified).
- [x] Regression tests in `src/policy/permission-preflight.test.mjs` and
      `tests/unit/discovery-classifier.test.mjs`.

## 2. Layer-1 documentation

- [x] Record read-only opencode allow-rules in `design.md` (user-owned config;
      WAM does not mutate it).

## 3. Validation

- [x] `node --test --test-force-exit src/policy/permission-preflight.test.mjs tests/unit/discovery-classifier.test.mjs`
- [x] `npm run build`
- [x] Fresh-session web verification `npm run verify:web -- --out /tmp/wam-web-e2e-readonly`
      (PASS, 9/9 checks; report at `/tmp/wam-web-e2e-readonly/report.md`).
