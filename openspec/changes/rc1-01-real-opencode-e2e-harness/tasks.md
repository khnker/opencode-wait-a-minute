# Tasks

## Implementation
- [x] Real OpenCode smoke harness exists: `tests/e2e/opencode/smoke.mjs` (spawns `opencode`, waits for a plugin event, isolates HOME/XDG).
- [x] Wired into the release gate as a required stage locally, skipped on GitHub Actions: `scripts/release-gate.mjs` (conditional on `GITHUB_ACTIONS`).
- [x] Packed-artifact variant: load the plugin from the installed `.tgz` (not the checkout) inside real OpenCode. The harness runs `npm pack`, installs the tarball into an isolated temp workspace, generates a thin adapter importing the installed `main`, and registers it via the temp project `opencode.jsonc` (`plugin: ["<adapter>"]`).
- [x] Machine-readable summary (`{artifact, instance, loaded, verdict}`) for the harness: printed on a single `WAM_E2E_SUMMARY ` stdout line and written to `$WAM_E2E_SUMMARY_PATH` when set (emitted before any non-zero exit).

## Validation
- [x] `node tests/e2e/opencode/smoke.mjs` exits 0 and prints `WAM_E2E_SUMMARY {"artifact":...,"instance":...,"loaded":true,"verdict":"pass"}` in the current environment (opencode 1.18.33).
- [x] Summary is fail-closed: a forced `opencode` failure emits `{...,"loaded":false,"verdict":"fail"}` and the JSON file before exiting non-zero.
- [x] Isolation preserved (HOME/XDG_*/WAM_HOME) and temp dirs removed via `rmSync` in `finally`.
- [x] `npm run gate` reports OpenCode Smoke E2E PASS.
- [x] `openspec validate rc1-01-real-opencode-e2e-harness --strict` passes.
