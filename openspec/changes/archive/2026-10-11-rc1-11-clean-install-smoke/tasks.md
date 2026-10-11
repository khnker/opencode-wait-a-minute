# Tasks

## Implementation
- [x] Clean-room flow scripted end to end: `npm ci` → `npm pack` → install `.tgz` → import smoke (`scripts/package-e2e.mjs`).
- [x] Package verifier reproduces pack + install + load in an isolated temp dir with no dependency on the checkout (`scripts/verify-package.mjs`).
- [x] No local-state dependency: runtime state lives under untracked `.wam/` (RC1-22), never read during pack/install.
- [x] Deterministic: pack/install run against `package.json#files` only, no network (`--no-save --no-package-lock`).

## Validation
- [x] `npm ci` succeeds from a clean checkout.
- [x] `npm pack` succeeds.
- [x] `npm run test:e2e:package` exits 0 (pack + clean install + smoke).
- [x] `npm run verify:package` exits 0 with no local-state dependency.
- [x] `openspec validate rc1-11-clean-install-smoke --strict` passes.
