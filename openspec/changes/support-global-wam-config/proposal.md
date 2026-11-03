# Change: support-global-wam-config

## Why

WAM configuration is currently project-scoped: `loadWamConfig` reads only
`<projectRoot>/.wam/config.json` (or `WAM_CONFIG` as a full path override).
Users who want the same settings — logging off, skills disabled, or task-loop
agent tuning — must duplicate `.wam/config.json` in every repository.

## What Changes

- Add a user-wide global config file resolved from `WAM_GLOBAL_CONFIG`,
  `$XDG_CONFIG_HOME/wam/config.json`, or `~/.config/wam/config.json`.
- Deep-merge the global file under the project file, so nested objects combine
  and project values win.
- Keep `WAM_CONFIG` as a complete location override: when set, the global file
  is not read or merged.
- Fail soft on missing, malformed, or non-object global files (`{}`).
- Export `resolveGlobalConfigPath()` and `readGlobalConfigFile()` for tests and
  diagnostics, without changing existing exports.
- Isolate tests and the test runner from the host machine's real global config.

## Impact

- Affected specs: `wam-config`
- Affected code: `src/config/wam-config.js`, `tests/unit/wam-config.test.mjs`,
  `scripts/run-tests.mjs`, `README.md`
- Non-goal: no commit, no changes to `~/.config` or the project `.wam/config.json`.
