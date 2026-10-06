# Tasks

## Implementation
- [x] Real OpenCode smoke harness exists: `tests/e2e/opencode/smoke.mjs` (spawns `opencode`, waits for a plugin event, isolates HOME/XDG).
- [x] Wired into the release gate as required stage "OpenCode Smoke E2E": `scripts/release-gate.mjs:32`.
- [ ] Packed-artifact variant: load the plugin from the installed `.tgz` (not the checkout) inside real OpenCode, emitting a machine-readable JSON summary.
- [ ] Machine-readable summary (`{artifact, instance, loaded, verdict}`) for the harness.

## Validation
- [x] `npm run test:e2e:opencode` exits 0 in the current environment.
- [x] `npm run gate` reports OpenCode Smoke E2E PASS.
- [x] `openspec validate rc1-01-real-opencode-e2e-harness --strict` passes.
