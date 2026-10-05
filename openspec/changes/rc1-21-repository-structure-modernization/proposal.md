# Change: Repository Structure Modernization

## Why
Root contains ~150 loose runtime files, tests, benchmarks and tooling, which increases cognitive load and makes change surface hard to control before RC1 freeze.

## What Changes
- Inventory every root-level file/dir and classify into KEEP ROOT / MOVE src / MOVE tests / MOVE benchmarks / MOVE docs / MOVE scripts / LEGACY.
- Consolidate root runtime modules (`*.js`, `.cjs`, non-test `.mjs`) into `src/` (flat), keeping `index.js` as the package entrypoint.
- Relocate unit test files to `tests/unit/` and the legacy monolith to `tests/legacy/`; existing `tests/{architecture,e2e,isolation}` retained.
- Relocate remaining benchmark harnesses to `benchmarks/`; existing benchmark tooling retained.
- Relocate loose design/report docs to `docs/`.
- Relocate stray tooling to `scripts/`.
- Rewrite every relative import/require/dynamic-import to the new locations (366 specifiers across 184 files).
- Update `package.json` (`files` adds `src/`; `test:legacy` path) and `scripts/run-tests.mjs` legacy path.
- No behavior change: purely structural. Legacy `openspec-change*.yaml` left at root as historical artifacts.

## Non-goals
- Creating folders without a category justification.
- Any functional change in the same change.
- Publishing if pack/install/E2E regress.

## Expected Result
Every root file is classified and moved to its category; `npm test`, `npm pack`, `pack:test` and E2E pass post-move.

## Validation
- [x] Inventory file produced and each entry classified (no UNCLASSIFIED).
- [x] `node scripts/run-tests.mjs` exits 0 (2569/0).
- [x] `npm pack` succeeds and `npm run pack:test` exits 0.
- [x] `npm run gate` reports RC1 READY.
- [x] No runtime module imported from the old root path (grep empty).

## Program
- RC1 item: RC1-21 (A)
- Priority: P0
