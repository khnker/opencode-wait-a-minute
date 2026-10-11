# Tasks

## Implementation
- [x] Explicit allowlist declared in `package.json#files` (runtime dirs + README/LICENSE, with `!**/*.test.*` and `!**/bench-*.mjs` negations).
- [x] `tests/unit/package-surface.test.mjs` packs with `npm pack --dry-run --json` and enumerates shipped paths.
- [x] Deny check: no path under `tests/`, `benchmarks/`, `docs/`, `scripts/`, `openspec/`, `.wam/`, `fixtures/`, and no `*.test.*` / `bench-*.mjs`.
- [x] Required-artifact check: `index.js`, `src/engine.js`, `preflight/request-classifier.js`, `skills/registry.json` must ship.
- [x] `package.json#files` must remain an explicit non-empty list containing `*.js`, `*.mjs`, `preflight/`, `skills/`.

## Validation
- [x] `node --test tests/unit/package-surface.test.mjs` passes (allowlist excludes dev artifacts; required artifacts ship).
- [x] `npm pack --dry-run` yields zero dev/test/bench paths.
- [x] `openspec validate rc1-10-package-allowlist --strict` passes.
