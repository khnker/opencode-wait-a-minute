# Tasks: CQE Core Extraction (CHANGE 02)

## Recon
- [x] Inventory sibling repo `/home/nicolas/dev/context-query-core` (API, package, audit)
- [x] Confirm `createEngine`/`runCQP`/`runIntent` seam in `src/core.js`
- [x] Identify global cache defect (`ENGINE_DIR/.cache.json`, ignored `cacheDir`)

## Package identity
- [x] Set real `repository`/`bugs`/`homepage` in `package.json`
- [x] Add `files` allowlist (`index.js`, `src/`, `README.md`, `LICENSE`)
- [x] Add `exports` map for public entry points
- [x] Fix duplicated `test` glob
- [x] Add `LICENSE` (MIT)
- [x] Add `verify:package` script

## Per-repository isolation (`src/engine.js`)
- [x] Add `os`/`crypto` imports
- [x] Add `ACTIVE_CACHE_DIR` + propagate through `withRoot(root, fn, cacheDir)`
- [x] Replace global `CACHE_FILE` with scoped `cacheFile()`
- [x] `persistCache()` creates parent dir; no writes into `ENGINE_DIR`
- [x] Forward `opts.cacheDir` in `runCQP` / `runIntent`

## Verification
- [x] `npm test` in sibling repo passes
- [x] `node scripts/verify-package.mjs` passes (pack → install → import → createEngine)
- [x] OpenSpec change validates

## Pending (owner decision)
- [ ] Decide dependency strategy (publish vs `file:` link) — blocker for CHANGE 03
- [ ] Decide fate of legacy `context-query-engine`/`contextforge`
- [ ] Commit sibling repo changes (awaiting explicit approval)
