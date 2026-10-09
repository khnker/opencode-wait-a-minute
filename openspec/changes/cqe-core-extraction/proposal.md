# Proposal: CQE Core Extraction (CHANGE 02)

## Problem

The context-query engine (CQE) currently lives coupled to transport concerns
(MCP server bootstrap, HTTP/stdio loops) inside a monolithic tree. This makes it
impossible to:

- Consume the engine as a normal library dependency (`import { createEngine }`).
- Guarantee that querying one repository does not mutate or pollute another.
- Package and publish a minimal, license-clean artifact with a stable API.

Concrete defects found during recon of `/home/nicolas/dev/context-query-core`:

- `src/engine.js` persisted its session cache to `ENGINE_DIR/.cache.json` — a
  path **inside the installed package** — and ignored the `cacheDir`/`indexDir`
  supplied by `createEngine()`. A consumer installing the package would mutate
  `node_modules/context-query-core/`.
- The in-process cache was a module-global `Map` shared across roots (keys were
  repo-qualified, but persistence was global).
- `package.json` carried placeholder `repository`/`bugs` URLs, no `files`
  allowlist, no `LICENSE`, and a duplicated test glob.

## Solution

Harden `context-query-core` into a standalone, importable, per-repository-isolated
package:

1. **Public API** via `index.js`: `createEngine`, `runCQP`, `runIntent`,
   `EvidenceEvaluator`, `QueryPlanner`, `Orchestrator`. No MCP/transport imports.
2. **Per-repo isolation**: replace the global `CACHE_FILE` with a scoped
   `cacheFile()` derived from the active root (or an explicit `cacheDir`).
   `withRoot()` now propagates `cacheDir`, and `runCQP`/`runIntent` forward
   `opts.cacheDir` so `createEngine({ cacheDir })` is honored.
3. **Publishable metadata**: real `repository`/`bugs`/`homepage`, `files`
   allowlist (`index.js`, `src/`, `README.md`, `LICENSE`), `LICENSE` (MIT),
   fixed `test` glob.
4. **Clean-install verifier** (`scripts/verify-package.mjs`): `npm pack` →
   install tarball into a fresh temp dir → import public API → construct
   `createEngine({ root })` without writing to the target repo.

## Scope

- `src/engine.js` — per-repo cache path, `withRoot` cacheDir propagation.
- `package.json` — identity, files allowlist, scripts.
- `index.js`, `src/core.js`, `src/{evidence-evaluator,query-planner,orchestrator}.js`
  — extraction seam (pre-existing WIP, validated by tests).
- `LICENSE`, `scripts/verify-package.mjs`, `test/cqe-standalone.test.mjs`.
- OpenSpec artifacts (this change) in the coordinating repo.

## Out of Scope

- Publishing to a registry / dependency strategy decision (see Open Questions).
- WAM runtime wiring (CHANGE 03).
- Benchmark evidence + README claims (CHANGE 04).

## Open Questions (require owner decision)

1. Dependency strategy: publish `context-query-core` to a registry vs keep a
   `file:../context-query-core` link from WAM.
2. Whether the older `context-query-engine`/`contextforge` tree is fully retired.
