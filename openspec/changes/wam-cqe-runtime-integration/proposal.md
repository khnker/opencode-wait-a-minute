# Proposal: WAM CQE Runtime Integration (CHANGE 03)

## Problem

`context-query-core` is now a standalone package (CHANGE 02) and WAM has a
committed adapter (`src/context/cqe-adapter.js`) that imports `createEngine`
from it. The remaining work is to make CQE file-context available to WAM's
context selection **without breaking the synchronous selector contract**.

An in-flight attempt made `selectContext` `async`. That is a breaking change:
`assembleContext` (`src/context/assembly.js:103`) is synchronous and has ~13
callers across `src/` and `tests/`. Making it `async` cascades through
`context-assembly-contract.js`, `message-handler.js`, and every test that
consumes a context package synchronously. The first attempt left 5 tests failing.

## Solution

Keep the synchronous `selectContext` intact and add a dedicated async entrypoint:

- `selectContext(task, opts)` — unchanged, synchronous, deterministic. No CQE.
- `selectContextWithCqe(task, opts)` — async; calls `selectContext`, then, for
  file-search intents, augments the package with `pkg.file_context` from
  `retrieveWithCqe` (best-effort; on error/empty the native package stands).

Re-export `selectContextWithCqe` from `src/context/selection.js`.

This delivers the CQE-backed context without touching `assembleContext` or its
callers.

## Scope

- `src/context/context.js` — revert `selectContext` to sync; add
  `selectContextWithCqe`; keep `detectFileSearchIntent`.
- `src/context/selection.js` — re-export the async variant.
- `tests/unit/cqe/select-context-cqe.test.mjs` — assert CQE augmentation.
- (Already committed) `src/context/cqe-adapter.js`, `package.json` `file:` dep,
  `tests/helpers/cqe/fixture.mjs`.

## Out of Scope

- Wiring `selectContextWithCqe` into `message-handler.js` / `assembleContext`
  (async runtime path) — follow-up.
- Benchmark evidence and README claims (CHANGE 04).
