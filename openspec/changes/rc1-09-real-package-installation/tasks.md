# Tasks

## Implementation
- [x] Verifier packs a `.tgz` via `npm pack` (no publish, no network): `scripts/verify-package.mjs:54`.
- [x] Verifier installs the `.tgz` into a fresh temp dir: `scripts/verify-package.mjs:66`.
- [x] Verifier asserts required runtime files exist in the install (`index.js`, `preflight/request-classifier.js`, `skills/registry.json`).
- [x] Verifier imports the installed package and asserts `loadBundledRegistry()` returns >500 skills with SKILL.md content.
- [x] Source-only success is impossible by construction: the verifier consumes the tarball, never the checkout.
- [x] Wired into the release gate as required stage "Package Integrity": `scripts/release-gate.mjs:28`.

## Validation
- [x] `npm run verify:package` exits 0 (pack + clean install + import smoke).
- [x] `npm run gate` reports RC1 READY with Package Integrity PASS.
- [x] `openspec validate rc1-09-real-package-installation --strict` passes.
