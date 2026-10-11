# Change: Plugin Load Compatibility

## Why
The WAM plugin currently fails to load in opencode with `Plugin export is not a function` (observed repeatedly in the server log, including immediately before session `ses_ee98e1200ffe2P6tupTw1RVeOL`). The entry module `index.js` exports a non-function named export (`sessionExecutions`, a `Map`). opencode's legacy plugin loader (`getLegacyPlugins`) requires that every export of the entry module be a plugin function (or `{ server }` object); the `Map` makes the loader throw and the whole plugin is discarded. As a result WAM runs disabled in every session: no `chat.message` gate, no `/wam` commands, no `.wam` memory is written.

## What Changes
- Stop exporting internal coordination state (`sessionExecutions`) at module scope in `index.js`; keep the `Map` private to the module.
- Add a regression test asserting that every export of the entry module namespace is a function, mirroring opencode's `getLegacyPlugins` contract.
- Preserve the default export (plugin factory) and the methods attached to it (`analyze`, `isTrivial`, `loadBundledRegistry`, `loadSkillOnDemand`); nothing consumes the removed named export.

## Capabilities
### New Capabilities
- `plugin-load-compatibility`: the WAM entry module is loadable by opencode's legacy plugin loader — its module namespace exposes only plugin functions, and internal state stays private.

### Modified Capabilities
<!-- none: no existing spec's requirements change -->

## Impact
- Affected code: `index.js` (module export surface), `tests/unit/plugin-load.test.mjs` (regression coverage).
- No runtime behavior change in the plugin logic: the `sessionExecutions` map is still created and used internally.
- No consumer breakage: no importer of `{ sessionExecutions }` exists (only a comment in `tests/e2e/opencode/smoke.mjs`).
- Enables WAM to actually load, which is a prerequisite for every other capability.
