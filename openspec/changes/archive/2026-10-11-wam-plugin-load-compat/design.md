# Design: Plugin Load Compatibility

## Context
opencode resolves `plugin: [".../plugin/wait-a-minute"]` and calls `applyPlugin`:

1. `readV1Plugin(load.mod, spec, "server", "detect")` — reads `mod.default`. WAM's default is a **function**, not a record, so `isRecord(value)` is false and `detect` mode returns `undefined`.
2. Falls back to `getLegacyPlugins(load.mod)`, which iterates `Object.values(mod)` and calls `getServerPlugin(entry)` on each. Any entry that is neither a function nor `{ server: function }` triggers `throw new TypeError("Plugin export is not a function")`.

Because `index.js` also exports `sessionExecutions` (a `Map`), step 2 throws and opencode discards the entire plugin.

## Decision
Keep exactly one meaningful module export: the default export (the plugin factory function). Internal state such as `sessionExecutions` MUST remain a module-local `const` and MUST NOT be exported.

If external inspection of internal state is ever genuinely required, it MUST be attached as a property of the default factory function (e.g. `WaitAMinutePlugin.sessionExecutions`) rather than as a named module export — opencode only inspects module namespace exports, not function properties.

## Alternatives Considered
- **Adopt the V1 plugin shape** (`export default { id, server }`): larger migration (id resolution, path-plugin id requirement) and not required to fix the defect.
- **Wrapper adapter** (as `tests/e2e/opencode/smoke.mjs` does): works only if the opencode config points at the wrapper; production config points at the repo entry, so it does not fix real-world loading.
- **Keep the export and patch opencode's loader**: not under our control and not our contract.

## Risks / Trade-offs
- A future contributor could re-introduce a non-function named export and silently break loading again. Mitigation: the regression test simulates `getLegacyPlugins` over the module namespace and fails on any non-function export.

## Verification
- `node --test tests/unit/plugin-load.test.mjs` passes, including the new namespace assertion.
- Manual: importing the entry module namespace yields only `default` (and any future exports are functions).
