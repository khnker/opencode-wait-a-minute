# Tasks: support-global-wam-config

- [x] Add `os` import, `resolveGlobalConfigPath()`, `readGlobalConfigFile()`,
      `deepMerge()` and `readMergedConfigFile()` in `src/config/wam-config.js`.
- [x] Use the merged file in `loadWamConfig` while keeping `WAM_CONFIG` as a
      full override that suppresses the global file.
- [x] Update the header comment with the new precedence and
      `WAM_GLOBAL_CONFIG` documentation.
- [x] Extend `tests/unit/wam-config.test.mjs` with `WAM_GLOBAL_CONFIG`
      isolation plus global-honored, deep-merge, missing-global and
      `WAM_CONFIG`-suppresses-global tests.
- [x] Set `WAM_GLOBAL_CONFIG` to a missing temp path in `scripts/run-tests.mjs`.
- [x] Document the global path and precedence in `README.md`.
- [x] Run `node --test --test-force-exit tests/unit/wam-config.test.mjs`.
- [x] Run `openspec validate --changes --strict`.
- [x] Run `npm run build`.
