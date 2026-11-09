# Design: Use CQE in the runtime retrieval path

## Problem

CQE is wired as best-effort augmentation, but two gates suppress it:

1. `src/context/context.js:623` — `selectContextWithCqe` only retrieves when
   `detectFileSearchIntent(task)` matches a keyword regex.
2. `src/integration/message-handler.js:763` — the runtime only calls
   `selectContextWithCqe` inside the same intent check.

The adapter therefore stays idle for normal prompts, and its `enabled` default
is misleading: enabling the adapter without a file-search keyword changes
nothing.

## Research

- CQE (`context-query-core`) is a deterministic lexical/symbolic retriever
  intended to run in-process with SQLite + trigram indexing:
  https://github.com/khnker/context-query-core
- The adapter already defines the safety envelope: timeout, worker isolation,
  typed fallback codes and `disabled|shadow|enabled` modes
  (`src/context/cqe-adapter.js`).
- Existing benchmark in `README.md` measures CQE against ripgrep; the contract
  is that CQE is augmentation and never has verification authority
  (`openspec/specs/cqe-integration/spec.md`).

## Alternatives

- **A. Remove the intent gate (chosen).** Every runtime retrieval consults CQE
  when enabled. The adapter already bounds results, degrades to native on
  error/empty, and can be disabled with `WAM_CQE_MODE=disabled`, `WAM_CQE=0` or
  `cfg.disableCqe`. Smallest complete diff and matches the documented default.
- **B. Broaden the intent regex.** Rejected: still a heuristic, still leaves
  most prompts without CQE, and adds maintenance for every new phrasing.
- **C. Make `assembleContext` async and call `selectContextWithCqe` inside it.**
  Rejected: the previous change (`wam-cqe-runtime-integration`) documented this
  as a ~13-caller cascade that breaks the synchronous selector contract.
- **D. Expose CQE only through an MCP tool.** Rejected: fixes explicit lookups
  but not the reported symptom (runtime never uses CQE).

## Decisions

- Keep `selectContext` synchronous and unchanged; `selectContextWithCqe` remains
  the async augmentation seam used by the runtime.
- CQE remains augmentation: it never gates sufficiency, verification or task
  state, and native context still wins on failure/empty.
- Preserve all opt-outs (`cfg.disableCqe`, `WAM_CQE=0`, `WAM_CQE_MODE`).
- Delete `detectFileSearchIntent` instead of leaving an unused export.

## Verification

- Affected suites: `tests/integration/cqe/select-context-with-cqe.test.mjs`,
  `tests/unit/cqe/select-context-cqe.test.mjs`, `test/message-handler.test.mjs`,
  `tests/unit/ctx-get-cqe.test.mjs`.
- `npm run build` and `openspec validate --changes --strict`.
- Fresh-session web verification per `AGENTS.md` when the environment allows.
