# Tasks

## Implementation
- [x] Single source of truth for versions checked by `scripts/verify-version-parity.mjs`.
- [x] Parity covers the declared version sources: `package.json#version` and `SKILL.md` frontmatter `metadata.version`.
- [x] Wired into the release gate as required stage "Version Parity": `scripts/release-gate.mjs:26`.
- [x] Divergence exits non-zero → gate reports FAIL; agreement → PASS.

## Validation
- [x] `npm run verify:version` exits 0 on the current tree.
- [x] `npm run gate` reports Version Parity PASS.
- [x] `openspec validate rc1-13-version-package-consistency --strict` passes.
