# Tasks

## Implementation
- [x] Inventory every root-level file/dir and classify into KEEP ROOT / MOVE src / MOVE tests / MOVE benchmarks / MOVE docs / MOVE scripts / LEGACY.
- [x] Consolidate root runtime modules into `src/` (125 modules), keeping `index.js` as entrypoint.
- [x] Relocate unit tests to `tests/unit/` and legacy monolith to `tests/legacy/`.
- [x] Relocate remaining benchmark harnesses to `benchmarks/`.
- [x] Relocate loose docs to `docs/`.
- [x] Relocate stray tooling to `scripts/`.
- [x] Rewrite all relative imports/requires/dynamic-imports (366 specifiers / 184 files).
- [x] Update `package.json` (`files` + `src/`, `test:legacy`) and `scripts/run-tests.mjs` legacy path.
- [x] No behavior change: this change is purely structural.
- [x] Root reduced from 301 loose files to 11 (index.js, package.json, package-lock.json, CHANGELOG.md, README.md, SKILL.md, 5 legacy openspec-change*.yaml). No UNCLASSIFIED remain.
- [x] `node scripts/run-tests.mjs` exits 0 (2569 tests / 335 suites / 0 fail).
- [x] `npm pack` succeeds and `npm run pack:test` exits 0 (pack:test PASSED).
- [x] `npm run gate` reports RC1 READY (58.7s, 0 skipped).
- [x] No runtime module imported from the old root path (13 path-hardcoding tests updated and green).

## Validation
- [x] Run the change's objective validation and paste the output.
- [x] `openspec validate rc1-21-repository-structure-modernization --strict` passes.
