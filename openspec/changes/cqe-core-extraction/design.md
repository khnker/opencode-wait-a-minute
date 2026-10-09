# Design: CQE Core Extraction (CHANGE 02)

## Architecture

Target repo: `/home/nicolas/dev/context-query-core` (branch `feature/standalone-cqe-poc`).
Coordinated from this repo's OpenSpec (cross-repo change).

```
consumer
   │  import { createEngine } from "context-query-core"
   ▼
index.js ──► src/core.js ──► createEngine({ root, cacheDir, indexDir, budget })
                 │
                 ├── EvidenceEvaluator({ repoRoot, cacheDir, indexDir })
                 ├── QueryPlanner({ repoRoot, cacheDir, indexDir })
                 └── Orchestrator({ repoRoot, cacheDir, indexDir, budget, ... })
                          │
                          ▼
                 src/engine.js  runCQP / runIntent
                          │  withRoot(root, fn, cacheDir)
                          ▼
                 ACTIVE_ROOT / ACTIVE_CACHE_DIR  (per-call scope)
                          │
                          ▼
                 cacheFile() = <cacheDir>/cache.json
                            || os.tmpdir()/context-query-core/<sha1(root)[0:12]>/cache.json
```

## Implementation

### Per-repository cache isolation (`src/engine.js`)

- Added `import os` / `import crypto`.
- Added `let ACTIVE_CACHE_DIR = null;` next to `ACTIVE_ROOT`.
- `withRoot(root, fn, cacheDir)` saves/restores both `ACTIVE_ROOT` and
  `ACTIVE_CACHE_DIR`; `cacheDir` is resolved to an absolute path when provided.
- Replaced `const CACHE_FILE = path.join(ENGINE_DIR, '.cache.json')` with:

  ```js
  function cacheFile() {
    const dir = ACTIVE_CACHE_DIR || path.join(
      os.tmpdir(), 'context-query-core',
      crypto.createHash('sha1').update(repoRoot()).digest('hex').slice(0, 12),
    );
    return path.join(dir, 'cache.json');
  }
  ```

- `clearCache()`, `loadCache()`, `persistCache()` now use `cacheFile()`;
  `persistCache()` creates the parent directory before writing.
- `runCQP` / `runIntent` forward `opts.cacheDir` into `withRoot`.

Net effect: no writes into `ENGINE_DIR` (the package dir), no writes into the
target repo by default, and distinct repos get distinct cache files even in the
same process.

### Package identity (`package.json`)

- `name: context-query-core`, `version: 1.0.0`, `type: module`, `main: index.js`.
- `exports` map for `.`, `./core`, `./evidence-evaluator`, `./query-planner`,
  `./orchestrator`.
- `files: ["index.js", "src/", "README.md", "LICENSE"]`.
- Real `repository` (`git+https://github.com/khnker/context-query-core.git`),
  `bugs`, `homepage`.
- Scripts: `test` (fixed glob), `verify:package`, `benchmark`, `benchmark:ci`.

### Clean-install verifier (`scripts/verify-package.mjs`)

1. `npm pack --pack-destination <tmp>`.
2. `npm install <tarball> --no-save --no-package-lock --silent` in a fresh dir.
3. Import `<installed>/index.js`; assert `createEngine`, `runCQP`, `runIntent`
   are functions.
4. `createEngine({ root })` returns an engine with `query()`.
5. Cleanup temp dir; exit non-zero on any failure.

## Verification

- `npm test` in the sibling repo → all suites pass (catalog-isolation, core,
  cqe-standalone, ignore).
- `node scripts/verify-package.mjs` → `verify-package PASSED`.

## Decisions

- Core exports MUST NOT import MCP/transport modules; those stay outside the
  public entry (`index.js`).
- Default cache location is `os.tmpdir()/context-query-core/<repoHash>/` to avoid
  mutating either the package or the target repository.
- `ACTIVE_*` scoping is synchronous and re-entrant (save/restore in `finally`).
