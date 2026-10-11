# Tasks: Plugin Load Compatibility

- [x] 1. Remove `export { sessionExecutions };` from `index.js` (keep the `const sessionExecutions = new Map()` private).
- [x] 2. Add regression test in `tests/unit/plugin-load.test.mjs` asserting every export of the entry module namespace is a function (mirrors opencode's `getLegacyPlugins`).
- [x] 3. Run `node --test tests/unit/plugin-load.test.mjs` and confirm all pass.
- [x] 4. Validate the change with `openspec validate wam-plugin-load-compat --strict`.
