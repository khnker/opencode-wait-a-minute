# Tasks: Permission Preflight Before Delegation

## 1. Policy module

- [x] Add `src/policy/permission-preflight.js` with `derivePermissionPlan`,
  `ensurePermissionPlan`, `permissionPreflightLines`, `grantPermissionPlan`,
  `denyPermissionPlan`, `decidePermission`, `delegationBlocked`.

## 2. Configuration

- [x] Add `permissionPreflight: true` default and env/file resolution in
  `src/config/wam-config.js`.
- [x] Register the `permissionPreflight` logic gate in `index.js`.

## 3. Runtime wiring

- [x] Add `permission.ask` hook that allows granted types.
- [x] Block `task` delegation while the plan is pending in `tool.execute.before`.
- [x] Inject the preflight notice from `src/integration/message-handler.js`.
- [x] Add `/wam permissions approve|deny` CLI.

## 4. Tests and docs

- [x] Unit tests in `src/policy/permission-preflight.test.mjs`.
- [x] Adapter test in `test/permission-preflight-adapter.test.mjs`.
- [x] Config tests updated in `tests/unit/wam-config.test.mjs`.
- [x] Document the hook in `docs/OPENCODE_COMPATIBILITY.md` and the control in README.
